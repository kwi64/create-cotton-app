"use strict";

/**
 * @fileoverview
 * Main configuration file for the CottonJS app.
 *
 * This file exports a single object containing application settings:
 *  - The server listening port and host.
 *  - Folder paths for build output and static assets.
 *  - WebSocket configurations for development.
 *  - A list of files to watch for development hot reloads.
 *
 */

export default {
  /**
   * The port on which the server will listen.
   * @type {number}
   */
  port: 3000,

  /**
   * The host name or IP address for the server.
   * Defaults to "localhost" in most non-Docker environments.
   * @type {string}
   */
  host: "localhost",

  /**
   * The folder where build outputs (e.g., compiled JS/CSS) are placed.
   * Make sure to update .gitignore & tsconfig.json accordingly.
   * @type {string}
   */
  build_folder: "build",

  /**
   * Folder path where public or static assets reside (e.g. images, fonts).
   * @type {string}
   */
  static_assets_folder: "public",

  /**
   * Port for the development WebSocket server used to notify clients of rebuilds.
   * @type {number}
   */
  dev_env_websocket_port: 4522,

  /**
   * The HTML element ID (e.g., a div) that the dev environment may scroll to after automatic reload.
   * @type {string}
   */
  dev_env_scroll_watch_id: "app",

  /**
   * A list of files or directories that should be watched in the development environment
   * for changes, triggering automatic reloads or rebuilds.
   * @type {string[]}
   */
  dev_env_files_to_watch: [
    "./src",
    "./public",
    "./core",
    "index.html",
    "route.config.js",
    "server.js",
    "build.js",
    "cotton.config.js",
  ],
};
