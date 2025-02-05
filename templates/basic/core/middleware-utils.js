import { IncomingMessage } from "http";
import { isMethodAsync } from "./module-utils.js";
import { rejects } from "assert";

// /**
//  * Gets the formatted middleware output
//  *
//  *
//  * @param {IncomingMessage} req
//  * @param {(req: IncomingMessage) => any} middlewareMethod
//  * @returns {Promise<import("cottonjs").FormattedMiddlewareResponse>}
//  */
// export async function getFormattedMiddlewareOutput(req, middlewareMethod) {
//   let output;
//   if (isMethodAsync(middlewareMethod)) {
//     output = await middlewareMethod(req);
//   } else {
//     output = middlewareMethod(req);
//   }

//   if (output instanceof Promise) {
//     try {
//       output = await output;
//     } catch (e) {}
//   }

//   // deciding whether to allow or not based on the output of the middleware
//   // TODO setup middleware shape type inference
//   const default_output = {
//     allow: false,
//     code: 401,
//     message: "This action is not allowed.",
//     contentType: "text/plain",
//   };

//   if (typeof output != "undefined" && output != true) {
//     if (output == false) {
//       return default_output;
//     } else if (typeof output == "string") {
//       return {
//         ...default_output,
//         message: output,
//       };
//     } else if (typeof output == "object") {
//       return Object.keys(default_output).reduce(
//         (acc, key) => (output[key] ? { ...acc, [key]: output[key] } : acc),
//         default_output
//       );
//     } else {
//       return default_output;
//     }
//   } else {
//     return { allow: true };
//   }
// }

/**
 * Gets the formatted middleware output
 *
 *
 * @param {IncomingMessage} req
 * @param {(req: IncomingMessage) => any} middlewareMethod
 * @returns
 */
export async function getFormattedMiddlewareOutput(req, middlewareMethod) {
  return new Promise(async (resolve) => {
    const output = {
      allow: false,
      code: 401,
      message: "This action is not allowed.",
      contentType: "text/plain",
    };

    let middlewareOutput;
    try {
      if (isMethodAsync(middlewareMethod)) {
        middlewareOutput = await middlewareMethod(req);
      } else {
        middlewareOutput = middlewareMethod(req);
      }
    } catch (e) {
      return resolve([e, null]);
    }

    // when esbuild minifies, async functions become promises. so following check is necessary.
    if (middlewareOutput instanceof Promise) {
      try {
        middlewareOutput = await middlewareOutput;
      } catch (e) {
        return resolve([e, null]);
      }
    }

    if (typeof middlewareOutput != "undefined" && middlewareOutput != true) {
      if (middlewareOutput == false) {
        return resolve([null, output]);
      } else if (typeof middlewareOutput == "string") {
        const formattedOutput = {
          ...output,
          message: middlewareOutput,
        };

        return resolve([null, formattedOutput]);
      } else if (typeof middlewareOutput == "object") {
        const formattedOutput = Object.keys(output).reduce(
          (acc, key) =>
            middlewareOutput[key]
              ? { ...acc, [key]: middlewareOutput[key] }
              : acc,
          output
        );

        return resolve([null, formattedOutput]);
      } else {
        return resolve([null, output]);
      }
    } else {
      return resolve([null, { allow: true }]);
    }
  });
}
