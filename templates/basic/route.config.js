"use strict";

/**
 * @fileoverview
 * Defines all application routes in a structured manner.
 */

/**
 * An object mapping route paths to their respective configurations. Properties include
 * - an optional `name` for identification,
 * - an optional `group` to group routes,
 * - a `page` to specify the location of the page component,
 * - an optional `loader` to load initial page data.
 *
 * @type {import("cottonjs").Routes}
 */
const routes = {
  "/": {
    name: "home",
    page: "src/Home",
  },
};

export default routes;
