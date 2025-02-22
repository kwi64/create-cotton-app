"use strict";

import chokidar from "chokidar";
import { join, resolve } from "path";
import { ChildProcess, fork } from "child_process";
import { WebSocketServer } from "ws";
import { existsSync } from "fs";
import config from "./cotton.config.js";
import { IncomingMessage } from "http";

const FALLBACK_HOST = "127.0.0.1";
const FALLBACK_PORT = 4522;

/**
 * Checks if the code is running inside a Docker container by testing
 * for the presence of the /.dockerenv file. If yes, host will be set to 0.0.0.0.
 */
const IS_DOCKER = existsSync("/.dockerenv");

/**
 * Environment for build and development server.
 */
const ENVIRONMENT = "dev";

/**
 * Host and port setup for WebSocket connections.
 */
const HOST = config.host || FALLBACK_HOST;
const PORT = config.dev_env_websocket_port || FALLBACK_PORT;

/**
 * Specifies the build folder for the compiled output.
 */
const BUILD_FOLDER = config.build_folder || "build";

/**
 * List of files and directories to watch for changes that trigger reloads.
 */
const DEV_ENV_FILES_TO_WATCH = config.dev_env_files_to_watch || [
  "./src",
  "index.html",
  "routes.config.js",
  "server.js",
  "build.js",
];

/**
 * Minimum time (in ms) between development server reloads to prevent excessive reloading.
 */
const SERVER_RELOAD_RATE_LIMIT_MS = 200;

/**
 * Paths for builder and server scripts.
 */
const BASE_PATH = join(resolve(), BUILD_FOLDER);
const BUILDER_SCRIPT = join(resolve(), "build.js");
const SERVER_SCRIPT = join(resolve(), BUILD_FOLDER, "server.js");

/**
 * Timer ID used for throttling server reload events.
 * @type {NodeJS.Timeout | null}
 */
let throttlerTimerId;

/**
 * Indicates whether a reload operation is already in progress.
 * @type {boolean}
 */
let isReloadInProgress;

/**
 * A reference to the builder process spawned via `fork()`.
 * @type {ChildProcess | null}
 */
let serverProcess = null;

/**
 * A reference to the builder process spawned via `fork()`.
 * @type {ChildProcess | null}
 */
let builderProcess = null;

/**
 * WebSocket server for notifying connected clients about reloads.
 * Uses Docker-aware hostname binding if applicable.
 */
const webSocketServer = new WebSocketServer({
  host: IS_DOCKER ? "0.0.0.0" : HOST,
  port: PORT,
});

webSocketServer.on(
  "connection",
  /**
   * Handles new WebSocket connections.
   *
   * @param {import("cottonjs").WebSocket} socket - The connected WebSocket client.
   * @param {IncomingMessage} req - The incoming HTTP/WS upgrade request.
   */
  (socket, req) => {
    try {
      // Extract the URL search params to identify the requested path
      const params = new URL(req.url ?? "/", `http://${HOST}`).searchParams;
      const urlPath = params.get("url_path");
      if (urlPath) {
        socket.url_path = urlPath;
        console.log("Watching for changes in:", urlPath);
      }
    } catch (error) {
      console.error("Error during WebSocket connection:", error);
    }
  }
);

/**
 * Spawns the builder process and listens for its "done" message.
 * Once build is complete, spawns the server process.
 */
function initializeBuilderAndServer() {
  builderProcess = fork(BUILDER_SCRIPT, [ENVIRONMENT]);

  builderProcess.on("error", (error) => {
    console.error("Builder process error:", error);
  });

  builderProcess.on(
    "message",
    /**
     * @param {import("cottonjs").IPCMessage} message
     */
    (message) => {
      if (message.status == "done") {
        spawnServerProcess();
      }
    }
  );
}

/**
 * Spawns the server process that actually handles HTTP requests.
 */
function spawnServerProcess(isReload = false) {
  const args = isReload ? [ENVIRONMENT, "reloading"] : [ENVIRONMENT];
  serverProcess = fork(SERVER_SCRIPT, args, { cwd: BASE_PATH });

  serverProcess.on("error", (err) => {
    console.error("Server process error:", err);
  });
}

/**
 * Sends a "reload" message to every connected WebSocket client.
 */
function sendReloadMessageToClients() {
  webSocketServer.clients.forEach((client) => {
    client.send(JSON.stringify({ type: "reload" }));
  });
}

/**
 * Orchestrates the rebuild and restart of the server, then notifies WebSocket clients.
 * Throttles reload events to avoid spamming rebuilds.
 */
function reloadAndNotifyClients() {
  if (throttlerTimerId) {
    clearTimeout(throttlerTimerId);
  }

  // Delayed execution to enforce rate limitin
  throttlerTimerId = setTimeout(() => {
    if (serverProcess && builderProcess) {
      if (isReloadInProgress) return;
      isReloadInProgress = true;

      // Gracefully terminate the old server process before starting a new one
      if (serverProcess.connected) {
        serverProcess.kill();
        serverProcess.on("close", () => {
          buildAndStartServer();
        });
      } else {
        buildAndStartServer();
      }
    }
  }, SERVER_RELOAD_RATE_LIMIT_MS);
}

/**
 * Builds the application using the builder script, then starts the server process.
 */
function buildAndStartServer() {
  builderProcess = fork(BUILDER_SCRIPT, [ENVIRONMENT]);
  builderProcess.on(
    "message",
    /**
     * @param {import("cottonjs").IPCMessage} message
     */
    (message) => {
      if (message.status == "done") {
        serverProcess = fork(SERVER_SCRIPT, [ENVIRONMENT, "reloading"], {
          cwd: BASE_PATH,
        });
        isReloadInProgress = false;
        sendReloadMessageToClients();
      }
    }
  );
}

/**
 * Chokidar instance to watch relevant files for changes.
 */
const watcher = chokidar.watch(DEV_ENV_FILES_TO_WATCH, {
  persistent: true,
  ignoreInitial: true,
});

/**
 * Initiates the rebuild/reload flow upon file changes.
 */
watcher.on("all", () => {
  reloadAndNotifyClients();
});

initializeBuilderAndServer();
