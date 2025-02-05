import busboy from "busboy";
import { IncomingMessage } from "http";

/**
 *
 * @param {IncomingMessage} req
 * @returns
 */
export const parseUrlEncodedFormData = (req) => {
  return new Promise((resolve, reject) => {
    let chunks = "";

    req.on("data", (chunk) => {
      chunks += chunk.toString();
    });

    req.on("error", (err) => {
      reject(err);
    });

    req.on("end", () => {
      const params = new URLSearchParams(chunks);
      const form_values = Object.fromEntries(params.entries());
      resolve(form_values);
    });
  });
};

/**
 *
 * @param {IncomingMessage} req
 * @returns
 */
export const parseMultipartFormData = (req) => {
  return new Promise((resolve, reject) => {
    const bb = busboy({ headers: req.headers });

    /** @type {{ [name: string]: {} }} */
    const result = {};

    bb.on("file", (name, file, info) => {
      const { filename, mimeType } = info;

      /** @type {*[]} */
      const chunks = [];
      file
        .on("data", (data) => {
          chunks.push(data);
        })
        .on("error", (err) => {
          reject(err);
        })
        .on("close", () => {
          result[name] = {
            type: "file",
            fileName: filename,
            mimeType: mimeType,
            value: Buffer.concat(chunks),
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
};
