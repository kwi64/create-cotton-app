import { renderToString } from "react-dom/server";
import { createElement } from "react";
import { join, basename, extname, dirname } from "path";

import config from "../cotton.config.js";
import routes from "../route.config.js";

const build_folder = config.build_folder || "build";
/**
 * Checks if a transpiled function is async or not.
 * This method is specifically used to decide whether an esbuild transpiled function is async or not
 *
 * @param {(...args: any[]) => {}} method
 * @returns {boolean}
 */
export function isMethodAsync(method) {
  const isArrowAsync = /^[^=>]+=>[^=>]+__async/.test(method.toString());
  const isAsync = new RegExp(`${method.name}[^{]+{[^{]+__async`).test(
    method.toString()
  );

  return isArrowAsync || isAsync;
}

/**
 * Gets initial loader data from the route config
 *
 * @param {import("cottonjs").RouteKey} route
 * @returns
 */
export async function getLoaderData(route) {
  return new Promise(async (resolve) => {
    const loader_data_location = routes[route].loader;
    if (!loader_data_location) {
      return resolve([null, undefined]);
    }

    let filename = basename(
      loader_data_location,
      !loader_data_location.endsWith(".loader")
        ? extname(loader_data_location)
        : ""
    );
    let module_path = join(dirname(loader_data_location), filename + ".js");

    try {
      const { default: method } = await import(`../${module_path}`);

      if (isMethodAsync(method)) {
        method()
          .then(
            /** @param {*} output */ (output) => {
              resolve([null, output]);
            }
          )
          .catch(
            /** @param {*} e */ (e) => {
              const err = `Exception in loader method in '${routes[route].loader}' while processing route '${route}'`;
              console.error("getLoaderData", {
                error: err,
                exception: e,
              });
              resolve([err, null]);
            }
          );
      } else {
        resolve([null, method()]);
      }
    } catch (e) {
      const err = `Either '${routes[route].loader}' loader file not found or exception in loader method while processing route '${route}'`;
      console.error("getLoaderData", {
        error: err,
        exception: e,
      });
      resolve([err, null]);
    }
  });
}

/**
 * Gets page html populated with loader data
 *
 * @param {import("cottonjs").RouteKey} route
 * @param {*} loader_data
 * @returns
 */
export async function getPageHtmlWithData(route, loader_data) {
  const page = routes[route].page;
  if (!page) {
    return [`Page not specified in route '${route}'`, null];
  }

  let filename = basename(page, extname(page));

  let module_path = join(dirname(page), filename + ".js");

  try {
    const { default: method } = await import(`../${module_path}`);

    const html = renderToString(createElement(method, loader_data));
    return [null, html];
  } catch (e) {
    const err = `Either default export is missing or page '${page}' not found while processing route '${route}'`;
    console.error("getPageHtmlWithData", {
      error: err,
      exception: e,
    });
    return [err, null];
  }
}

export const mainjs = `
    import { createElement } from "react";
    import { hydrateRoot } from "react-dom/client";

    const data = window.__COTTON_DATA__;


    import("./${build_folder}/route.config")
      .then(({ default: routes }) => {
        const loadPage = routes[data.cotton.route].module;
        loadPage()
          .then(({ default: page }) => {
            hydrateRoot(document.getElementById("root"), createElement(page, data));
          })
          .catch((_) => {
            console.error("Routes mismatch at", data.cotton.route);
          });
      })
      .catch((err) => {
        console.log("Error loading module", err);
      });
    `;
