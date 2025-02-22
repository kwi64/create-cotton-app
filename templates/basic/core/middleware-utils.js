"use strict";

import { IncomingMessage } from "http";
import { isMethodAsync } from "./module-utils.js";

/**
 * @fileoverview
 * Provides a utility to execute a middleware function and return a structured response.
 * - If the middleware disallows the request, a default `deny` response is provided.
 * - If the middleware returns a string, it is treated as a custom message in the deny response.
 * - If the middleware returns an object, relevant properties override the defaults.
 * - Otherwise, the request is allowed.
 */

/**
 * Executes the given middleware function and returns a formatted response.
 *
 * @param {IncomingMessage} req - The HTTP request object.
 * @param {(req: IncomingMessage) => any} middlewareMethod - The middleware function to execute.
 * @returns {Promise<[Error | null, import("cottonjs").FormattedMiddlewareResponse | null]>}
 */
export async function getFormattedMiddlewareOutput(req, middlewareMethod) {
  // A default deny response used when middleware returns false or an equivalent disallow signal.
  const defaultDenyResponse = {
    allow: false,
    code: 401,
    message: "This action is not allowed.",
    contentType: "text/plain",
  };

  let middlewareOutput;

  try {
    // If the method is recognized as async (via esbuild transpilation check), await directly.
    // Otherwise, call it synchronously and check for a Promise result.
    if (isMethodAsync(middlewareMethod)) {
      middlewareOutput = await middlewareMethod(req);
    } else {
      middlewareOutput = middlewareMethod(req);

      // Some async functions minified by esbuild may appear synchronous.
      // If we detect a Promise, await it to get the resolved value.
      if (middlewareOutput instanceof Promise) {
        middlewareOutput = await middlewareOutput;
      }
    }
  } catch (error) {
    return [/** @type {Error} */ (error), null];
  }

  // Determine how to structure the final response based on middlewareOutput.
  // - `true` or `undefined`: request allowed.
  // - `false`: request disallowed with default message.
  // - `string`: treat as a custom disallow message.
  // - `object`: override default disallow properties if present.
  // - Else: fall back to default disallow.
  switch (true) {
    case middlewareOutput === true:
    case typeof middlewareOutput === "undefined":
      return [null, { allow: true }];

    case middlewareOutput === false:
      return [null, defaultDenyResponse];

    case typeof middlewareOutput === "string":
      return [
        null,
        {
          ...defaultDenyResponse,
          message: middlewareOutput,
        },
      ];

    case typeof middlewareOutput === "object":
      const formattedOutput = Object.keys(defaultDenyResponse).reduce(
        (acc, key) =>
          key in middlewareOutput
            ? { ...acc, [key]: middlewareOutput[key] }
            : acc,
        { ...defaultDenyResponse }
      );
      return [null, formattedOutput];

    default:
      return [null, defaultDenyResponse];
  }
}
