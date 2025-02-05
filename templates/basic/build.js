import {
  readFile,
  writeFile,
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

const build_folder = config.build_folder || "build";
const publid_folder = config.static_assets_folder || "public";

(async () => {
  /**
   * List of ordered tasks to complete the build.
   */
  const tasks = [
    () => prepareBuildFolder(),
    () => buildServer(),
    () => buildSrc(),
    () => buildMainJs(), // Finally build main.js
  ];

  try {
    for (const task of tasks) {
      await task();
    }
    if (process.send) process.send({ status: "done" });
  } catch (e) {
    if (process.send) process.send({ status: "error" });
    console.log("Build failed", e);
  }
})();

/**
 * Gets all files in the directory
 *
 * @param {string} dir
 * @returns {Promise<string[]>} File paths
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

export async function prepareBuildFolder() {
  await rm(join(resolve(), build_folder), {
    recursive: true,
    force: true,
  });
  await mkdir(join(resolve(), build_folder));
  await rm(join(resolve(), build_folder, "client"), {
    recursive: true,
    force: true,
  });
  await rm(join(resolve(), build_folder, "module.css"), {
    force: true,
  });
  await copyFile("index.html", join(resolve(), build_folder, "index.html"));
  await cp(publid_folder, join(resolve(), build_folder, publid_folder), {
    recursive: true,
  });
}

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
    outdir: join(resolve(), build_folder),
    platform: "node",
    minify: !(process.argv[2] && process.argv[2] == "dev"),
    plugins: [plugins["route-modules"]],
  });
}

async function buildSrc() {
  const pageEntries = await getFilesInDirectory("./src");

  await build({
    entryPoints: [...pageEntries],
    bundle: true,
    outdir: join(resolve(), build_folder, "src"),
    format: "esm",
    target: "es6",
    splitting: true,
    treeShaking: true,
    platform: "node",
    external: ["react", "react-dom"],
    jsx: "automatic",
    plugins: [plugins["global-css"], plugins["module-css"]],
    minify: !(process.argv[2] && process.argv[2] == "dev"),
  });
}

async function buildMainJs() {
  await build({
    entryNames: "main",
    stdin: {
      contents: mainjs,
      loader: "js",
      resolveDir: ".",
    },
    bundle: true,
    outdir: join(resolve(), build_folder, "client"),
    format: "esm",
    target: "es6",
    splitting: true,
    treeShaking: true,
    platform: "browser",
    minify: !(process.argv[2] && process.argv[2] == "dev"),
  });
}

/**
 *
 * @type {import("cottonjs").EsBuildPlugins}
 */
const plugins = {
  "global-css": {
    name: "global-css",
    /**
     * Custom Global CSS Plugin for esbuild.
     * This plugin processes `.css` files and appends their content to a global CSS file, excluding `.module.css` files.
     *
     */
    setup(build) {
      build.onLoad({ filter: /\.css$/ }, async (args) => {
        if (args.path.endsWith(".module.css")) return;

        const css = await readFile(args.path, "utf8");

        await appendFile(
          join(resolve(), build_folder, "global.css"),
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
     * Custom Module CSS Plugin for esbuild.
     * This plugin processes `*.module.css` files and appends their content to a module CSS file.
     */
    setup(build) {
      build.onLoad({ filter: /\.module\.css$/ }, async (args) => {
        const regex = /\.([a-zA-Z0-9_-]+)(?=\s*[{\s>:,(\[\.])/g;

        /**
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
          join(resolve(), build_folder, "module.css"),
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
     * Creates module for the route page.
     *
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
