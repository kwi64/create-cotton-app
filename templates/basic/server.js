import { IncomingMessage, createServer } from "http";
import { existsSync } from "fs";
import { parse } from "url";
import config from "./cotton.config.js";
import requestExtensions from "./core/http-extensions.js";
import { getMatchingRoute } from "./core/route-utils.js";
import { serveApi, serveFile, servePage } from "./core/http-serve-utils.js";

const host = config.host || "localhost";
const port = config.port || 8080;

/**
 * Note: if docker, then host will be statically set to 0.0.0.0
 */
const isDocker = existsSync("/.dockerenv");

const httpServer = createServer(async (req, res) => {
  const parsed_url = parse(req.url ?? "/", true);

  let { pathname } = parsed_url;
  pathname = pathname ?? "/";

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

  if (pathname?.startsWith("/api")) {
    Object.assign(IncomingMessage.prototype, requestExtensions);
    return serveApi(req, res);
  }

  const { route, params } = getMatchingRoute(pathname);

  if (route) {
    return servePage({
      res,
      pathname,
      route,
      params,
    });
  }

  res.writeHead(404, { "Content-Type": "text/plain" });
  res.end("404 Not Found");
  return;
});

httpServer
  .listen(port, isDocker ? "0.0.0.0" : host, () => {
    if (process.argv[3] && process.argv[3] == "reloading") {
      console.log(`Development server reloaded on http://${host}:${port}`);
    } else {
      console.log(`CottonJs running on http://${host}:${port}`);
    }
  })
  .on("error", (err) => {
    console.log("CottonJS listening error", err);
  });
