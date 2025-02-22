"use strict";

/**
 * Main entry point for the CottonJS HTTP server.
 * - Determines the host and port from cotton.config.js. Otherwise defaults to localhsot:8080
 * - Detects Docker environment for host binding
 * - Serves static files, API endpoints, and pages
 *
 * @module CottonServer
 */

import { IncomingMessage, ServerResponse, createServer } from "http";
import { existsSync } from "fs";
import { parse } from "url";
import config from "./cotton.config.js";
import httpRequestExtensions from "./core/http-extensions.js";
import { getMatchingRoute } from "./core/route-utils.js";
import { serveApi, serveFile, servePage } from "./core/http-serve-utils.js";

const FALLBACK_HOST = "localhost";
const FALLBACK_PORT = 8080;

/**
 * Checks if the code is running inside a Docker container by testing
 * for the presence of the /.dockerenv file. If yes, host will be set to 0.0.0.0.
 */
const IS_DOCKER = existsSync("/.dockerenv");

const HOST = config.host || FALLBACK_HOST;
const PORT = config.port || FALLBACK_PORT;

/**
 * Handles incoming requests.
 * Serves static files, API, or page routes based on the URL path.
 *
 * @async
 * @param {IncomingMessage} req - The Node.js incoming request object
 * @param {ServerResponse}  res - The Node.js server response object
 */
async function handleRequest(req, res) {
  try {
    // Safely parse URL
    const parsedUrl = parse(req.url ?? "/", true);
    let { pathname } = parsedUrl;
    pathname = pathname ?? "/";

    // Serve static files from /public and other known paths
    if (pathname.startsWith("/public/")) {
      return serveFile(res, pathname);
    }
    if (pathname.startsWith("/global.css")) {
      return serveFile(res, "global.css");
    }
    if (pathname.startsWith("/module.css")) {
      return serveFile(res, "module.css");
    }
    if (pathname.startsWith("/client")) {
      return serveFile(res, pathname);
    }

    // Serve API routes
    if (pathname.startsWith("/api")) {
      // Attach request extension methods
      Object.assign(IncomingMessage.prototype, httpRequestExtensions);
      return serveApi(req, res);
    }

    // Attempt to match a route in the CottonJS routing system
    const { route, params } = getMatchingRoute(pathname);
    if (route) {
      return servePage({
        res,
        pathname,
        route,
        params,
      });
    }

    // No match found, return 404
    res.writeHead(404, { "Content-Type": "text/plain" });
    res.end("404 Not Found");
  } catch (error) {
    console.error("Error handling request:", error);
    res.writeHead(500, { "Content-Type": "text/plain" });
    res.end("500 Internal Server Error");
  }
}

/**
 * Create and start the HTTP server.
 */
const httpServer = createServer(handleRequest);

/**
 * Listening on the provided host and port.
 */
httpServer
  .listen(PORT, IS_DOCKER ? "0.0.0.0" : HOST, () => {
    if (process.argv[3] == "reloading") {
      console.log(`Development server reloaded on http://${HOST}:${PORT}`);
    } else {
      console.log(`CottonJs running on http://${HOST}:${PORT}`);
    }
  })
  .on("error", (err) => {
    console.log("CottonJS listening error", err);
  });
