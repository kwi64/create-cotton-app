import chokidar from "chokidar";
import { join, resolve } from "path";
import { ChildProcess, fork } from "child_process";
import { WebSocketServer } from "ws";
import { existsSync } from "fs";
import config from "./cotton.config.js";
import { IncomingMessage } from "http";

/**
 * @type {NodeJS.Timeout}
 */
let throttler_timer_id;

/**
 * @type {boolean}
 */
let reload_in_progress;

/**
 * @type {ChildProcess?}
 */
let server;

const host = config.host || "127.0.0.1";
const port = config.dev_env_websocket_port || 4522;
const build_folder = config.build_folder || "build";

const dev_env_files_to_watch = config.dev_env_files_to_watch || [
  "./src",
  "index.html",
  "routes.config.js",
  "server.js",
  "build.js",
];

const server_reload_rate_limit_ms = 200;

const isDocker = existsSync("/.dockerenv"); // if docker; host will be statically set to 0.0.0.0

const wss = new WebSocketServer({ host: isDocker ? "0.0.0.0" : host, port });

const basePath = join(resolve(), build_folder);
const builderjs = join(resolve(), "build.js");
const serverjs = join(resolve(), build_folder, "server.js");

const ENVIRONMENT = "dev";

let builder = fork(builderjs, [ENVIRONMENT]);
builder.on(
  "message",
  /**
   * @param {import("cottonjs").IPCMessage} message
   */
  (message) => {
    if (message.status == "done") {
      server = fork(serverjs, [ENVIRONMENT], { cwd: basePath });
    }
  }
);

wss.on(
  "connection",
  /**
   *
   * @param {import("cottonjs").WebSocket} socket
   * @param {IncomingMessage} req
   */
  (socket, req) => {
    const params = new URL(req.url ?? "/", `http://${host}`).searchParams;
    const url_path = params.get("url_path");
    if (url_path) {
      console.log("Watching for changes in: ", url_path);
      socket.url_path = url_path;
    }
  }
);

function notify() {
  wss.clients.forEach((client) => {
    client.send(JSON.stringify({ type: "reload" }));
  });
}

function reloadAndNotify() {
  if (throttler_timer_id) {
    clearTimeout(throttler_timer_id);
  }

  const run_builder_and_server = () => {
    builder = fork(builderjs, [ENVIRONMENT]);
    builder.on(
      "message",
      /**
       * @param {import("cottonjs").IPCMessage} message
       */
      (message) => {
        if (message.status == "done") {
          server = fork(serverjs, [ENVIRONMENT, "reloading"], {
            cwd: basePath,
          });
          reload_in_progress = false;
          notify();
        }
      }
    );
  };

  throttler_timer_id = setTimeout(() => {
    if (server && builder) {
      if (reload_in_progress) return;
      reload_in_progress = true;

      if (server.connected) {
        server.kill();
        server.on("close", () => {
          run_builder_and_server();
        });
      } else {
        run_builder_and_server();
      }
    }
  }, server_reload_rate_limit_ms);
}

const watcher = chokidar.watch(dev_env_files_to_watch, {
  persistent: true,
  ignoreInitial: true,
});

watcher.on("all", () => {
  reloadAndNotify();
});
