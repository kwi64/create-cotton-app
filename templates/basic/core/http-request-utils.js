"use strict";

import busboy from "busboy";
import { IncomingMessage } from "http";

/**
 * @fileoverview
 * Utility functions for parsing form data from HTTP requests:
 * - `parseUrlEncodedFormData` for application/x-www-form-urlencoded data.
 * - `parseMultipartFormData` for multipart/form-data.
 */

/**
 * Parses `application/x-www-form-urlencoded` data from an incoming HTTP request.
 *
 * @param {IncomingMessage} req - The Node.js HTTP request object.
 * @returns {Promise<Record<string, string>>} A promise that resolves to an object of key-value pairs from the form data.
 */
export function parseUrlEncodedFormData(req) {
  return new Promise((resolve, reject) => {
    let chunks = "";

    req.on("data", (chunk) => {
      chunks += chunk.toString();
    });

    req.on("error", (error) => {
      reject(error);
    });

    req.on("end", () => {
      try {
        const params = new URLSearchParams(chunks);
        const formValues = Object.fromEntries(params.entries());
        resolve(formValues);
      } catch (error) {
        reject(error);
      }
    });
  });
}

/**
 * Parses `multipart/form-data` from an incoming HTTP request using Busboy.
 *
 * Captures both file and text fields.
 * File fields include a Buffer of file contents under `value`.
 * Text fields store their string value in `value`.
 *
 * @param {IncomingMessage} req - The Node.js HTTP request object.
 * @returns {Promise<Record<string, any>>}
 *   A promise that resolves to an object where each key is a form field name.
 *   For file fields, the value is `{ type, fileName, mimeType, value<Buffer> }`.
 *   For text fields, the value is `{ type, value<string> }`.
 */
export function parseMultipartFormData(req) {
  return new Promise((resolve, reject) => {
    const bb = busboy({ headers: req.headers });

    /** @type {Record<string, any>} */
    const result = {};

    bb.on("file", (name, file, info) => {
      const { filename, mimeType } = info;

      /** @type {*[]} */
      const fileChunks = [];
      file
        .on("data", (data) => {
          fileChunks.push(data);
        })
        .on("error", (err) => {
          reject(err);
        })
        .on("close", () => {
          result[name] = {
            type: "file",
            fileName: filename,
            mimeType: mimeType,
            value: Buffer.concat(fileChunks),
          };
        });
    });

    bb.on("field", (name, val) => {
      result[name] = {
        type: "field",
        value: val,
      };
    });
    bb.on("error", (err) => {
      reject(err);
    });
    bb.on("finish", () => {
      resolve(result);
    });

    req.pipe(bb);
  });
}
