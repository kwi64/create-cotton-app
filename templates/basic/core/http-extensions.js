import { parse } from "url";
import {
  parseUrlEncodedFormData,
  parseMultipartFormData,
} from "./http-request-utils.js";

/**
 * @type {import("cottonjs").RequestExtensions}
 */
const requestExtensions = {
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
          // trying to getBody() on a non-multipart/form-data
          resolve({});
        }
      } else {
        // trying to getBody() on a a request that has not content-type specified
        resolve({});
      }
    });
  },
};

export default requestExtensions;

// /**
//  * @type {import("cottonjs").GetQueryExtension}
//  */
// export function getBody() {
//   return new Promise((resolve, reject) => {
//     if (this.headers["content-type"]) {
//       if (
//         /^application\/x-www-form-urlencoded/i.test(
//           this.headers["content-type"]
//         )
//       ) {
//         parseUrlEncodedFormData(this)
//           .then((result) => resolve(result))
//           .catch((err) => {
//             reject(err);
//           });
//       } else if (/^multipart\/form-data;/i.test(this.headers["content-type"])) {
//         parseMultipartFormData(this)
//           .then((result) => resolve(result))
//           .catch((err) => reject(err));
//       } else {
//         reject("Content-type not supported.");
//       }
//     } else {
//       // content type undefined?
//       reject("Content-type not supported.");
//     }
//   });
// }

// IncomingMessage.prototype.getBody = function () {
//   return new Promise((resolve, reject) => {
//     if (this.headers["content-type"]) {
//       if (
//         /^application\/x-www-form-urlencoded/i.test(
//           this.headers["content-type"]
//         )
//       ) {
//         parseUrlEncodedFormData(this)
//           .then((result) => resolve(result))
//           .catch((err) => {
//             console.log("error inside promise", err);
//             reject(err);
//           });
//       } else if (/^multipart\/form-data;/i.test(this.headers["content-type"])) {
//         parseMultipartFormData(this)
//           .then((result) => resolve(result))
//           .catch((err) => reject(err));
//       } else {
//         reject("Content-type not supported.");
//       }
//     } else {
//       // content type undefined?
//       reject("Content-type not supported.");
//     }
//   });
// };

// IncomingMessage.prototype.getQuery = function () {
//   return new Promise((resolve, reject) => {
//     try {
//       const { query } = parse(this.url ?? "/", true);
//       resolve(query);
//     } catch (err) {
//       reject(err);
//     }
//   });
// };
