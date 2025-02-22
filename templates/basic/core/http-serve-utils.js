"use strict";

import { IncomingMessage, ServerResponse } from "http";
import { readFile, existsSync } from "fs";
import { format, parse } from "url";
import { join, resolve, extname, relative } from "path";
import { getFormattedMiddlewareOutput } from "./middleware-utils.js";
import {
  getLoaderData,
  getPageHtmlWithData,
  isMethodAsync,
} from "./module-utils.js";
import routes from "../route.config.js";
import config from "../cotton.config.js";
import mimeTypes from "./mimeTypes.js";

/**
 * @fileoverview
 * Provides functions to serve static files, render pages, and handle API endpoints.
 */

const {
  host = "localhost",
  dev_env_scroll_watch_id = "root",
  dev_env_websocket_port = 4522,
} = config;

/**
 * Serves a static file from the file system.
 *
 * @async
 * @param {ServerResponse} res - The HTTP response object.
 * @param {string} url - The file path or URL to serve (relative to the project root).
 */
export async function serveFile(res, url) {
  const filePath = join(resolve(), url);

  let extension = /** @type {keyof mimeTypes} */ (String(extname(url)));

  let contentType = mimeTypes[extension] || "text/plain";

  readFile(filePath, (error, content) => {
    if (error) {
      res.writeHead(500, { "Content-Type": "text/plain" });
      res.end(`500 Internal Server Error. ${error}`);
      return;
    }

    res.writeHead(200, {
      "Content-Type": contentType,
    });
    res.end(content);
  });
}

/**
 * Serves a page. Fetches loader data, then renders the page into HTML.
 *
 * @async
 * @param {object} args
 * @param {ServerResponse} args.res - The HTTP response object.
 * @param {string} args.pathname - The requested URL path (e.g., "/users/123").
 * @param {import("cottonjs").RouteKey} args.route - A route key from the application routes.
 * @param {Record<string, string>} [args.params] - Key-value pairs for dynamic route parameters.
 */
export async function servePage({ res, pathname, route, params }) {
  const [loader_error, loader_data] = await getLoaderData(route);

  /**
   * @type {import("cottonjs").CottonData}
   */
  const cotton_data = {
    route: {
      key: route,
      group: routes[route].group,
      name: routes[route].name,
      params: params ?? {},
    },
    loader: loader_data,
  };

  const [page_error, page_html] = await getPageHtmlWithData(route, cotton_data);

  const ws = format({
    protocol: "ws",
    hostname: host,
    port: dev_env_websocket_port,
    query: { url_path: pathname },
  });

  const devScript = `
      const _scroll_watch_element = document.getElementById("${dev_env_scroll_watch_id}");
      var _scroll_position = localStorage.getItem('${pathname}_scroll_position');

      if (_scroll_position && _scroll_watch_element) {
        _scroll_watch_element.scrollTo(0, _scroll_position);
        localStorage.removeItem('${pathname}_scroll_position');
      }

      const socket = new WebSocket("${ws}");
      socket.onmessage = (event) => {
        const { type } = JSON.parse(event.data);
        if (type === "reload") {
          
          if(_scroll_watch_element){
            localStorage.setItem("${pathname}_scroll_position", _scroll_watch_element.scrollTop);
          }

          location.reload();
        }
      };
    `;

  const htmlPath = join(resolve(), "index.html");

  const globalCssExists = existsSync(join(resolve(), "global.css"));
  let moduleCssExists = existsSync(join(resolve(), "module.css"));

  const timestamp = new Date().getTime(); // to prevent cashing, specially for the module css

  const globalCss = `<link rel="stylesheet" href="/global.css?t=${timestamp}" />`;
  const moduleCss = `<link rel="stylesheet" href="/module.css?t=${timestamp}" />`;
  const mainScriptTag = `<script defer type="module" src="/client/main.js?t=${timestamp}"></script>`;

  readFile(htmlPath, "utf8", async (err, content) => {
    if (err) {
      res.writeHead(500, { "Content-Type": "text/plain" });
      res.end(
        "500 Internal Server Error: Could not find entry point index.html"
      );
      return;
    }

    const devMode = process.argv[2] === "dev";

    let html = content
      .replace(
        "<!--scripts-->",
        `
          <script>
            window.__COTTON_DATA__ = ${JSON.stringify(cotton_data)};
            ${devMode ? devScript : ""}
          </script>
          ${!(page_error || loader_error) ? mainScriptTag : ""}
        `
      )
      .replace(
        "<!--css-->",
        `
          ${globalCssExists ? globalCss : ""}
          ${moduleCssExists ? moduleCss : ""}
        `
      )
      .replace("<!--page-->", page_error || loader_error || page_html || "");
    res.writeHead(200, { "Content-Type": "text/html" });
    res.end(html);
  });
}

/**
 * Handles calls to API endpoints under the `/api` path.
 * Dynamically loads an endpoint module, checks optional middleware,
 * and executes the endpoint’s response method.
 *
 * @async
 * @param {IncomingMessage} req - The HTTP request object.
 * @param {ServerResponse} res - The HTTP response object.
 */
export async function serveApi(req, res) {
  let { pathname } = parse(req.url ?? "/", true);
  pathname = pathname ?? "/";

  let normalized_path = /\/$/.test(pathname) ? pathname : pathname + "/";

  /**
   * @type {string | undefined} method_name
   */
  let methodName;

  const modulePath = join("src", normalized_path).replace(
    /^(src\\api(?:\\.+)*\\(?:[^\\]+))\\([^\\]+)\\$/g,
    (_, mpath, method) => {
      methodName = method;
      return mpath;
    }
  );

  const apiUrl = relative("src", modulePath).replace(/\\/g, "/");

  if (!relative(join("src", "api"), modulePath)) {
    res.writeHead(400, { "Content-Type": "text/plain" });
    res.end(`Invalid api call with url '/${apiUrl}'`);
    return;
  }

  if (!methodName) {
    res.writeHead(400, { "Content-Type": "text/plain" });
    res.end(`No endpoint specified in the api url '/${apiUrl}'`);
    return;
  }

  res.setHeader(
    "Access-Control-Allow-Methods",
    "GET, POST, PUT, DELETE, OPTIONS"
  );

  let module;

  try {
    module = await import(`../${modulePath}.js`);

    if (typeof module.default == "function") {
      const [primaryMiddlewareError, primaryMiddlewareOutput] =
        await getFormattedMiddlewareOutput(req, module.default);

      if (primaryMiddlewareError) {
        const errorMsg = `An error occured in the primary middleware at '${apiUrl}'. See server log for more info.`;
        console.error("serveApi", {
          error: errorMsg,
          exception: primaryMiddlewareError,
        });
        res.writeHead(500, { "Content-Type": "text/plain" });
        res.end(errorMsg);
        return;
      }

      if (primaryMiddlewareOutput != null && !primaryMiddlewareOutput.allow) {
        res.writeHead(primaryMiddlewareOutput.code ?? 401, {
          "Content-Type": primaryMiddlewareOutput.contentType ?? "text/plain",
        });
        res.end(primaryMiddlewareOutput.message);
        return;
      }
    }
  } catch (error) {
    const errorMsg = `An error occured in the primary middleware at '${apiUrl}'. See server log for more info.`;
    console.error("serveApi", {
      error: errorMsg,
      exception: error,
    });
    res.writeHead(500, { "Content-Type": "text/plain" });
    res.end(errorMsg);
    return;
  }

  if (!module[`${methodName}`]) {
    res.writeHead(500, { "Content-Type": "text/plain" });
    res.end(
      `Endpoint '${methodName}' is not defined or exported from '${apiUrl}'.`
    );
    return;
  }

  if (
    module[`${methodName}`].method &&
    !new RegExp(module[`${methodName}`].method, "i").test(req.method ?? "GET")
  ) {
    res.writeHead(404, { "Content-Type": "text/plain" });
    res.end(
      `Endpoint '${methodName}' expected HTTP ${
        module[`${methodName}`].method
      } but received HTTP ${req.method} at '${apiUrl}'.`
    );
    return;
  }

  try {
    if (typeof module[`${methodName}`].middleware == "function") {
      const [error, secondaryMiddlewareOutput] =
        await getFormattedMiddlewareOutput(
          req,
          module[`${methodName}`].middleware
        );

      if (error) {
        const errorMsg = `An error occurred in the middleware at '${apiUrl}/${methodName}'. See server logs for details.`;
        console.error("serveApi", {
          error: errorMsg,
          exception: error,
        });
        res.writeHead(500, { "Content-Type": "text/plain" });
        res.end(errorMsg);
        return;
      }

      if (
        secondaryMiddlewareOutput != null &&
        !secondaryMiddlewareOutput.allow
      ) {
        res.writeHead(secondaryMiddlewareOutput.code ?? 401, {
          "Content-Type": secondaryMiddlewareOutput.contentType ?? "text/plain",
        });
        res.end(secondaryMiddlewareOutput.message);
        return;
      }
    }
  } catch (error) {
    const errorMsg = `An error occured in the middleware at '${apiUrl}/${methodName}' endpoint. See server logs for more info.`;
    console.error("serveApi", {
      error: errorMsg,
      exception: error,
    });
    res.writeHead(500, { "Content-Type": "text/plain" });
    res.end(errorMsg);
    return;
  }

  if (!module[`${methodName}`].response) {
    res.writeHead(404, { "Content-Type": "text/plain" });
    res.end(`response() is not defined in '${apiUrl}/${methodName}' endpoint.`);
    return;
  }

  try {
    if (isMethodAsync(module[`${methodName}`].response)) {
      await module[`${methodName}`].response({ req, res });
    } else {
      module[`${methodName}`].response({ req, res });
    }
  } catch (error) {
    const errorMsg = `An error occured in the response() at '${apiUrl}/${methodName} endpoint'. See server logs for more info.`;
    console.error("serveApi", {
      error: errorMsg,
      exception: error,
    });
    res.writeHead(500, { "Content-Type": "text/plain" });
    res.end(errorMsg);
  }
}
