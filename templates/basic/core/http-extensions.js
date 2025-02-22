"use strict";

import { parse } from "url";
import {
  parseUrlEncodedFormData,
  parseMultipartFormData,
} from "./http-request-utils.js";

/**
 * @fileoverview
 * Provides HTTP request extension methods for retrieving query parameters
 * and request body data.
 */

/**
 * Implementation of the httpRequestExtensions. Designed to extend the
 * `IncomingMessage.prototype`.
 *
 * @type {import("cottonjs").HttpRequestExtensions}
 */
const httpRequestExtensions = {
  /**
   * Processes the query parameters from the request URL.
   *
   * @returns {Promise<Record<string, any>>} A promise resolving to a key-value object of query parameters.
   */
  getQuery() {
    return new Promise((resolve, reject) => {
      try {
        const { query } = parse(this.url ?? "/", true);
        resolve({ ...query });
      } catch (err) {
        reject(err);
      }
    });
  },

  /**
   * Asynchronously retrieves the request body data, interpreting the
   * `Content-Type` header to handle url-encoded or multipart form data.
   *
   * @returns {Promise<any>} A promise resolving to the parsed body data. Returns an empty object if
   *   the request is not form data or no content-type is specified.
   */
  getBody() {
    return new Promise((resolve, reject) => {
      if (this.headers["content-type"]) {
        if (
          /^application\/x-www-form-urlencoded/i.test(
            this.headers["content-type"]
          )
        ) {
          parseUrlEncodedFormData(this)
            .then((result) => resolve(result))
            .catch((err) => {
              reject(err);
            });
        } else if (
          /^multipart\/form-data;/i.test(this.headers["content-type"])
        ) {
          parseMultipartFormData(this)
            .then((result) => resolve(result))
            .catch((err) => reject(err));
        } else {
          // Fallback for unsupported or non-form content types
          resolve({});
        }
      } else {
        // No content-type header present
        resolve({});
      }
    });
  },
};

export default httpRequestExtensions;
