"use strict";

import routes from "../route.config.js";

/**
 * @fileoverview
 * This provides utility functions for matching a route
 */

/**
 * Finds and returns the route in `route.config.js` that matches the given pathname,
 * along with any dynamic parameters (e.g. ":id") captured from the URL.
 *
 * @param {string} pathname - The incoming URL path (e.g., "/users/123").
 * @returns {{
 *   route?: import("cottonjs").RouteKey,
 *   params?: Record<string, string>,
 * }} An object containing the matched route and the extracted parameters.
 */
export function getMatchingRoute(pathname) {
  // Ensure a trailing slash for uniformity (e.g. "/users" -> "/users/")
  let normalizedUrl = /\/$/.test(pathname) ? pathname : pathname + "/";

  let matchingRoutes = Object.keys(routes).filter((route) => {
    let normalized_route = /\/$/.test(route) ? route : route + "/";

    let routeRegex = new RegExp(
      "^" + normalized_route.replace(/:[^\/]+/g, "[^\\/]+") + "$",
      "i"
    );

    return routeRegex.test(normalizedUrl);
  });

  if (matchingRoutes.length > 0) {
    let match = /** @type {import("cottonjs").RouteKey} */ (matchingRoutes[0]);

    const normalizedMatch = /\/$/.test(matchingRoutes[0]) ? match : match + "/";

    const paramKeyRegex = new RegExp(
      `^${normalizedMatch.replace(/:[^\/]+/g, ":([^\\/]+)")}$`,
      "i"
    );

    const paramValueRegex = new RegExp(
      `^${normalizedMatch.replace(/:[^\/]+/g, "([^\\/]+)")}$`,
      "i"
    );
    const keyMatches = normalizedMatch.match(paramKeyRegex);
    const valueMatches = normalizedUrl.match(paramValueRegex);

    /** @type {Record<string, string>} */
    const params = {};

    if (keyMatches && valueMatches) {
      if (keyMatches.length == valueMatches.length) {
        for (let i = 1; i < keyMatches.length; i++) {
          params[keyMatches[i]] = valueMatches[i];
        }
      }
    }

    return {
      route: match,
      params,
    };
  }

  return {};
}
