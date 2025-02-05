import { IncomingMessage, ServerResponse, createServer } from "http";
import { readFile, existsSync } from "fs";
import { format, parse } from "url";
import { join, resolve, extname, relative } from "path";
import { getFormattedMiddlewareOutput } from "./middleware-utils.js";
import { getLoaderData, getPageHtmlWithData } from "./module-utils.js";
import routes from "../route.config.js";
import config from "../cotton.config.js";
import mimeTypes from "./mimeTypes.js";

const host = config.host || "localhost";
const dev_env_websocket_port = config.dev_env_websocket_port || 4522;

/**
 * Checks if a transpiled function is async or not.
 * This method is specifically used to decide whether an esbuild transpiled function is async or not
 *
 * @param {(...args: any[]) => {}} method
 * @returns {boolean}
 */
function isMethodAsync(method) {
  const isArrowAsync = /^[^=>]+=>[^=>]+__async/.test(method.toString());
  const isAsync = new RegExp(`${method.name}[^{]+{[^{]+__async`).test(
    method.toString()
  );

  return isArrowAsync || isAsync;
}

/**
 * Serves a static file
 *
 * @param {ServerResponse} res
 * @param {string} url
 */
export async function serveFile(res, url) {
  const filePath = join(resolve(), url);

  let ext = /** @type {keyof mimeTypes} */ (String(extname(url)));

  let contentType = mimeTypes[ext] || "text/plain";

  readFile(filePath, (err, content) => {
    if (err) {
      res.writeHead(500, { "Content-Type": "text/plain" });
      res.end("500 Internal Server Error. " + err);
      return;
    }

    res.writeHead(200, {
      "Content-Type": contentType,
    });
    res.end(content);
    return;
  });
}

/**
 * Serves the relevant page specified in the routes
 *
 * @param {{
 *  res: ServerResponse,
 *  pathname: string,
 *  route: import("cottonjs").RouteKey,
 *  params?: {[key: string]: string}
 * }} args
 */
export async function servePage({ res, pathname, route, params }) {
  const [loader_error, loader_data] = await getLoaderData(route);

  const cotton_data = {
    cotton: {
      route: route,
      route_name: routes[route].name,
      route_params: params ?? {},
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

  const ws_client_js = `const socket = new WebSocket("${ws}");
            socket.onmessage = (event) => {
              const { type } = JSON.parse(event.data);
              if (type === "reload") location.reload();
            };`;

  const html_path = join(resolve(), "index.html");

  const globalCssExists = existsSync(join(resolve(), "global.css"));
  let moduleCssExists = existsSync(join(resolve(), "module.css"));

  const globalCss = '<link rel="stylesheet" href="/global.css" />';
  const moduleCss = '<link rel="stylesheet" href="/module.css" />';
  const mainjs = '<script defer type="module" src="/client/main.js"></script>';

  readFile(html_path, "utf8", async (err, content) => {
    if (err) {
      res.writeHead(500, { "Content-Type": "text/plain" });
      res.end(
        "500 Internal Server Error: Could not find entry point index.html"
      );
      return;
    }

    let html = content
      .replace(
        "<!--scripts-->",
        `
          <script>
            window.__COTTON_DATA__ = ${JSON.stringify(cotton_data)};
            ${process.argv[2] && process.argv[2] == "dev" ? ws_client_js : ""}
          </script>
          ${!(page_error || loader_error) ? mainjs : ""}
          `
      )
      .replace(
        "<!--css-->",
        `${globalCssExists ? globalCss : ""}
          ${moduleCssExists ? moduleCss : ""}`
      )
      .replace("<!--page-->", page_error || loader_error || page_html);
    res.writeHead(200, { "Content-Type": "text/html" });
    res.end(html);
    return;
  });
}

/**
 *
 *
 * @param {IncomingMessage} req
 * @param {ServerResponse} res
 */
export async function serveApi(req, res) {
  let { pathname } = parse(req.url ?? "/", true);
  pathname = pathname ?? "/";

  let normalized_path = /\/$/.test(pathname) ? pathname : pathname + "/";

  /**
   * @type {string | undefined} method_name
   */
  let method_name;

  const module_path = join("src", normalized_path).replace(
    /^(src\\api(?:\\.+)*\\(?:[^\\]+))\\([^\\]+)\\$/g,
    (_, mpath, method) => {
      method_name = method;
      return mpath;
    }
  );

  const api_url = relative("src", module_path).replace(/\\/g, "/");

  if (!relative(join("src", "api"), module_path)) {
    res.writeHead(400, { "Content-Type": "text/plain" });
    res.end(`Invalid api call with url '/${api_url}'`);
    return;
  }

  if (!method_name) {
    res.writeHead(400, { "Content-Type": "text/plain" });
    res.end(`No endpoint specified in the api url '/${api_url}'`);
    return;
  }

  res.setHeader(
    "Access-Control-Allow-Methods",
    "GET, POST, PUT, DELETE, OPTIONS"
  );

  let module;

  try {
    module = await import(`../${module_path}.js`);

    if (typeof module.default == "function") {
      const [e, primaryMiddlewareOutput] = await getFormattedMiddlewareOutput(
        req,
        module.default
      );

      if (e) {
        const err = `An error occured in the primary middleware at '${api_url}'. See server log for more info.`;
        console.error("serveApi", {
          error: err,
          exception: e,
        });
        res.writeHead(500, { "Content-Type": "text/plain" });
        res.end(err);
        return;
      }

      if (!primaryMiddlewareOutput.allow) {
        res.writeHead(primaryMiddlewareOutput.code ?? 401, {
          "Content-Type": primaryMiddlewareOutput.contentType ?? "text/plain",
        });
        res.end("PRIMARY: " + primaryMiddlewareOutput.message);
        return;
      }
    }
  } catch (e) {
    const err = `An error occured in the primary middleware at '${api_url}'. See server log for more info.`;
    console.error("serveApi", {
      error: err,
      exception: e,
    });
    res.writeHead(500, { "Content-Type": "text/plain" });
    res.end(err);
    return;
  }

  if (!module[`${method_name}`]) {
    res.writeHead(500, { "Content-Type": "text/plain" });
    res.end(
      `Endpoint '${method_name}' is not defined or exported from '${api_url}'.`
    );
    return;
  }

  if (
    module[`${method_name}`].method &&
    !new RegExp(module[`${method_name}`].method, "i").test(req.method ?? "GET")
  ) {
    res.writeHead(404, { "Content-Type": "text/plain" });
    res.end(
      `Endpoint '${method_name}' expected HTTP ${
        module[`${method_name}`].method
      } but received HTTP ${req.method} at '${api_url}'.`
    );
    return;
  }

  try {
    if (typeof module[`${method_name}`].middleware == "function") {
      const [error, secondaryMiddlewareOutput] =
        await getFormattedMiddlewareOutput(
          req,
          module[`${method_name}`].middleware
        );

      if (!secondaryMiddlewareOutput.allow) {
        res.writeHead(secondaryMiddlewareOutput.code ?? 401, {
          "Content-Type": secondaryMiddlewareOutput.contentType,
        });
        res.end(secondaryMiddlewareOutput.message);
        return;
      }
    }
  } catch (e) {
    const err = `An error occured in the middleware at '${api_url}/${method_name}' endpoint. See server logs for more info.`;
    console.error("serveApi", {
      error: err,
      exception: e,
    });
    res.writeHead(500, { "Content-Type": "text/plain" });
    res.end(err);
    return;
  }

  if (!module[`${method_name}`].response) {
    res.writeHead(404, { "Content-Type": "text/plain" });
    res.end(
      `response() is not defined in '${api_url}/${method_name}' endpoint.`
    );
    return;
  }

  try {
    if (isMethodAsync(module[`${method_name}`].response)) {
      await module[`${method_name}`].response({ req, res });
    } else {
      module[`${method_name}`].response({ req, res });
    }
  } catch (e) {
    const err = `An error occured in the response() at '${api_url}/${method_name} endpoint'. See server logs for more info.`;
    console.error("serveApi", {
      error: err,
      exception: e,
    });
    res.writeHead(500, { "Content-Type": "text/plain" });
    res.end(err);
  }
}
