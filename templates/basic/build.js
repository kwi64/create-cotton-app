"use strict";

/**
 * @fileoverview
 * This file builds the CottonJS app.
 * 1. Prepares the build folder and copies necessary files.
 * 2. Builds the server-side code, including routes and core modules.
 * 3. Builds the src directory (pages, components, etc.).
 * 4. Builds the main.js (client entry).
 *
 * Plugins are included for handling:
 *   - Global CSS
 *   - Module CSS
 *   - Route modules (dynamic imports for routes)
 */

import {
  readFile,
  appendFile,
  rm,
  cp,
  mkdir,
  copyFile,
  readdir,
} from "fs/promises";
import { join, resolve, basename, extname, dirname } from "path";
import { build } from "esbuild";
import { randomBytes } from "crypto";
import config from "./cotton.config.js";
import { mainjs } from "./core/module-utils.js";
import { pathToFileURL } from "url";

/**
 * Primary build folder as configured in cotton.config.js.
 * @type {string}
 */
const BUILD_FOLDER = config.build_folder || "build";

/**
 * Public folder for static assets (images, CSS, etc.).
 * @type {string}
 */
const PUBLIC_FOLDER = config.static_assets_folder || "public";

/**
 * Orchestrates the build steps in a specific order.
 */
(async () => {
  /**
   * List of build tasks to complete the build.
   */
  const tasks = [
    () => prepareBuildFolder(),
    () => buildServer(),
    () => buildSrc(),
    () => buildMainJs(),
  ];

  try {
    for (const task of tasks) {
      await task();
    }
    // Signal completion to parent process if running in a child process
    if (process.send) {
      process.send({ status: "done" });
    }
  } catch (e) {
    // Signal error to parent process if running in a child process
    if (process.send) {
      process.send({ status: "error" });
    }
    console.log("Build failed", e);
  }
})();

/**
 * Recursively gets all files in the directory
 *
 * @param {string} dir [dir="./src"] - The directory path to search.
 * @returns {Promise<string[]>} - A list of file paths.
 */
async function getFilesInDirectory(dir = "./src") {
  const files = [];

  const entries = await readdir(dir, {
    withFileTypes: true,
  });

  for (const entry of entries) {
    const entry_path = join(entry.parentPath, entry.name);
    if (entry.isFile()) {
      files.push(entry_path);
    } else {
      const nestedFiles = await getFilesInDirectory(entry_path);
      files.push(...nestedFiles);
    }
  }

  return files;
}

/**
 * Removes and recreates the build folder. Copies base files and public assets.
 *
 * @async
 */
export async function prepareBuildFolder() {
  await rm(join(resolve(), BUILD_FOLDER), {
    recursive: true,
    force: true,
  });
  await mkdir(join(resolve(), BUILD_FOLDER));
  await rm(join(resolve(), BUILD_FOLDER, "client"), {
    recursive: true,
    force: true,
  });
  await rm(join(resolve(), BUILD_FOLDER, "module.css"), {
    force: true,
  });
  await copyFile("index.html", join(resolve(), BUILD_FOLDER, "index.html"));
  await cp(PUBLIC_FOLDER, join(resolve(), BUILD_FOLDER, PUBLIC_FOLDER), {
    recursive: true,
  });
}

/**
 * Checks whether the build is running in development mode based on CLI arguments.
 *
 * @returns {boolean} True if dev mode is detected.
 */
function isDevMode() {
  return process.argv[2] === "dev";
}

/**
 * Builds the server components (including route.config, core modules, etc.).
 *
 * @async
 */
export async function buildServer() {
  await build({
    entryPoints: [
      "./server",
      "./route.config.js",
      "./cotton.config.js",
      "./core/*",
    ],
    splitting: true,
    format: "esm",
    target: "es6",
    treeShaking: true,
    resolveExtensions: [".ts", ".js"],
    outdir: join(resolve(), BUILD_FOLDER),
    platform: "node",
    minify: !isDevMode(),
    plugins: [plugins["route-modules"]],
  });
}

/**
 * Builds all source files from ./src directory (page components).
 *
 * @async
 */
async function buildSrc() {
  const pageEntries = await getFilesInDirectory("./src");

  await build({
    entryPoints: [...pageEntries],
    bundle: true,
    outdir: join(resolve(), BUILD_FOLDER, "src"),
    format: "esm",
    target: "es6",
    splitting: true,
    treeShaking: true,
    platform: "node",
    external: ["react", "react-dom"],
    jsx: "automatic",
    plugins: [plugins["global-css"], plugins["module-css"]],
    minify: !isDevMode(),
  });
}

/**
 * Builds the main.js entry point for the client.
 *
 * @async
 */
async function buildMainJs() {
  await build({
    entryNames: "main",
    stdin: {
      contents: mainjs,
      loader: "js",
      resolveDir: ".",
    },
    bundle: true,
    outdir: join(resolve(), BUILD_FOLDER, "client"),
    format: "esm",
    target: "es6",
    splitting: true,
    treeShaking: true,
    platform: "browser",
    minify: !isDevMode(),
  });
}

/**
 * @type {import("cottonjs").EsBuildPlugins}
 * A collection of custom esbuild plugins for handling CSS (both global and module)
 * and generating route-based dynamic imports.
 */
const plugins = {
  "global-css": {
    name: "global-css",
    /**
     * Plugin to handle global (non-module) CSS files.
     * Appends their content into one `global.css` file.
     */
    setup(build) {
      build.onLoad({ filter: /\.css$/ }, async (args) => {
        if (args.path.endsWith(".module.css")) return;

        const css = await readFile(args.path, "utf8");

        await appendFile(
          join(resolve(), BUILD_FOLDER, "global.css"),
          css,
          "utf8"
        );

        return null;
      });
    },
  },

  "module-css": {
    name: "module-css",
    /**
     * Plugin to handle CSS modules (`*.module.css`).
     * Generates a unique, hashed CSS class name, appends content to `module.css`,
     * and provides a JS module exporting the class map.
     */
    setup(build) {
      build.onLoad({ filter: /\.module\.css$/ }, async (args) => {
        const regex = /\.([a-zA-Z0-9_-]+)(?=\s*[{\s>:,(\[\.])/g;

        /**
         * A cache to store original class names and hashed class names
         * @type {Record<string, string>}
         */
        const classMap = {};

        const cssContent = await readFile(args.path, "utf8");

        const transformedCSS = cssContent.replace(regex, (_, className) => {
          if (!classMap[className]) {
            const hashedName = `${className}_${randomBytes(6).toString("hex")}`;
            classMap[className] = hashedName;
          }

          return `.${classMap[className]}`;
        });

        await appendFile(
          join(resolve(), BUILD_FOLDER, "module.css"),
          transformedCSS,
          "utf8"
        );

        const jsContent = `
                export const styles = ${JSON.stringify(classMap)};
                export default styles;
              `;

        return {
          contents: jsContent,
          loader: "js",
        };
      });
    },
  },

  "route-modules": {
    name: "route-modules",
    /**
     * Plugin that transforms `route.config.js` to enable dynamic route imports.
     * Identifies each route's `page` property, turning it into a dynamic `import()`.
     */
    setup(build) {
      build.onLoad({ filter: /route.config.js$/ }, async (args) => {
        const filePath = pathToFileURL(args.path).href;

        try {
          const { default: routes } = await import(filePath);

          let content = "const routes = {\n";
          Object.keys(routes).forEach((route) => {
            if (typeof routes[route] != "object") return;

            let route_content = JSON.stringify(routes[route]);

            let route_file = routes[route].page;

            if (route_file) {
              let filename = basename(route_file, extname(route_file));
              let directory = dirname(route_file);
              let module_path = join(directory, filename).replace(/\\/g, "/");

              let normalized_module_path = /^\//.test(module_path)
                ? `.${module_path}`
                : `./${module_path}`;

              let module_line = `() => import("${normalized_module_path}").catch(_ => console.error('Route "${route}" cannot find page "${normalized_module_path}"'))`;

              route_content = JSON.stringify({
                ...routes[route],
                module: "<!--module-->",
              }).replace('"<!--module-->"', module_line);
            }

            content += `\t"${route}": ${route_content},\n`;
          });
          content += "}\n";
          content += "export default routes;";

          return {
            contents: content,
            loader: "js",
          };
        } catch (err) {
          console.log("An error occured building route.config.js", err);
          return null;
        }
      });
    },
  },
};
