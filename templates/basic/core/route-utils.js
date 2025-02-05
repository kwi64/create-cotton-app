import routes from "../route.config.js";

/**
 * Finds the matching route based on the url
 *
 * @param {string} pathname
 * @returns {{ route?: import("cottonjs").RouteKey, params?: {[key: string]: string} }}
 */
export function getMatchingRoute(pathname) {
  let normalized_url = /\/$/.test(pathname) ? pathname : pathname + "/";

  let matches = Object.keys(routes).filter((route) => {
    let normalized_route = /\/$/.test(route) ? route : route + "/";

    let regex = new RegExp(
      "^" + normalized_route.replace(/:[^\/]+/g, "[^\\/]+") + "$",
      "i"
    );

    return regex.test(normalized_url);
  });

  if (matches.length > 0) {
    let match = /** @type {import("cottonjs").RouteKey} */ (matches[0]);

    const normalized_match = /\/$/.test(matches[0]) ? match : match + "/";

    const match_regex = new RegExp(
      `^${normalized_match.replace(/:[^\/]+/g, ":([^\\/]+)")}$`,
      "i"
    );
    const url_regex = new RegExp(
      `^${normalized_match.replace(/:[^\/]+/g, "([^\\/]+)")}$`,
      "i"
    );
    const key_matches = normalized_match.match(match_regex);
    const value_matches = normalized_url.match(url_regex);

    /** @type {{[key: string]: string}} */
    const params = {};

    if (key_matches && value_matches) {
      if (key_matches.length == value_matches.length) {
        for (let i = 1; i < key_matches.length; i++) {
          params[key_matches[i]] = value_matches[i];
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
