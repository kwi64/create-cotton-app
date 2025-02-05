export default {
  port: 3000,
  host: "localhost",
  build_folder: "build", // update .gitignore & tsconfig.json
  static_assets_folder: "public",
  dev_env_websocket_port: 4522,
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
