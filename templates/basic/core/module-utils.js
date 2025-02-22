"use strict;";

import { renderToString } from "react-dom/server";
import { createElement } from "react";
import { join, basename, extname, dirname } from "path";
import config from "../cotton.config.js";
import routes from "../route.config.js";

/**
 * @fileoverview
 * This provides utility functions for:
 * - Checking if a function transpiled by esbuild is async.
 * - Retrieving loader data for a given route (e.g., from a `*.loader` file).
 * - Rendering a React page to HTML with the above data.
 * - Exporting a main client-side JS snippet (`mainjs`) for hydrating the React application.
 */

/**
 * The primary build folder location from cotton.config.js
 * @type {string}
 */
const BUILD_FOLDER = config.build_folder || "build";

/**
 * Checks if an esbuild-transpiled function is async.
 *
 * @param {(...args: any[]) => any} func - The function to examine.
 * @returns {boolean} True if the function is an async function.
 */
export function isMethodAsync(func) {
  const isArrowAsync = /^[^=>]+=>[^=>]+__async/.test(func.toString());
  const isAsync = new RegExp(`${func.name}[^{]+{[^{]+__async`).test(
    func.toString()
  );

  return isArrowAsync || isAsync;
}

/**
 * Retrieves initial loader data for a given route from its associated loader file.
 *
 * @async
 * @param {import("cottonjs").RouteKey} route - The route for which to load data.
 * @returns {Promise<[string|null, any|undefined]>} A tuple of `[error, data]`. If error is `null`, `data` will contain loader results.
 */
export async function getLoaderData(route) {
  const loaderFile = routes[route]?.loader;
  if (!loaderFile) {
    return [null, undefined];
  }

  // Remove file extensions except for `.loader` to determine the base filename
  const loaderFilename = basename(
    loaderFile,
    !loaderFile.endsWith(".loader") ? extname(loaderFile) : ""
  );

  const modulePath = join(dirname(loaderFile), `${loaderFilename}.js`);
  try {
    // Dynamically import the loader module
    const { default: loaderFunc } = await import(`../${modulePath}`);

    if (isMethodAsync(loaderFunc)) {
      try {
        const output = await loaderFunc();
        return [null, output];
      } catch (error) {
        const errMsg = `Exception in loader method in '${routes[route].loader}' while processing route '${route}'.`;
        console.error("getLoaderData", {
          error: errMsg,
          exception: error,
        });
        return [errMsg, null];
      }
    } else {
      return [null, loaderFunc()];
    }
  } catch (error) {
    const errMsg = `Either '${routes[route].loader}' not found or an exception occurred in the loader method for route '${route}'.`;
    console.error("getLoaderData", {
      error: errMsg,
      exception: error,
    });
    return [errMsg, null];
  }
}

/**
 * Renders a page component to an HTML string, injecting the provided loader data as props.
 *
 * @async
 * @param {import("cottonjs").RouteKey} route - The route whose page component should be rendered.
 * @param {any} loaderData - Data to be passed to the page component as props.
 * @returns {Promise<[string|null, string|null]>} A tuple of `[error, html]`.
 *   If error is `null`, `html` will contain the rendered markup.
 */
export async function getPageHtmlWithData(route, loaderData) {
  const page = routes[route].page;
  if (!page) {
    return [`Page not specified in route '${route}'`, null];
  }

  let filename = basename(page, extname(page));

  let modulePath = join(dirname(page), filename + ".js");

  try {
    const { default: method } = await import(`../${modulePath}`);

    const html = renderToString(createElement(method, loaderData));
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

/**
 * A client-side entry script as a string, appended to `main.js`.
 * It dynamically imports `route.config` at runtime, finds the matched route,
 * and hydrates the root React element with the corresponding page component.
 *
 * @type {string}
 */
export const mainjs = `
  import { createElement } from "react";
  import { hydrateRoot } from "react-dom/client";

  const data = window.__COTTON_DATA__;


  import("./${BUILD_FOLDER}/route.config")
    .then(({ default: routes }) => {
      const loadPage = routes[data.route.key].module;
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
