"use strict";

/**
 * @fileoverview
 * A mapping of file extensions to their corresponding MIME types.
 *
 * This object helps in setting the correct "Content-Type" header when serving files.
 * Each key is a file extension, and its value is the MIME type.
 */

const mimeTypes = {
  // Text files
  ".html": "text/html",
  ".css": "text/css",
  ".csv": "text/csv",
  ".javascript": "text/javascript",
  ".plain": "text/plain",
  ".txt": "text/plain",
  ".js": "application/javascript",
  ".json": "application/json",
  ".xml": "application/xml",

  // Images
  ".jpeg": "image/jpeg",
  ".jpg": "image/jpeg",
  ".png": "image/png",
  ".gif": "image/gif",
  ".webp": "image/webp",
  ".svg": "image/svg+xml",
  ".ico": "image/x-icon",
  ".bmp": "image/bmp",

  // Audio
  ".mp3": "audio/mpeg",
  ".wav": "audio/wav",
  ".ogg": "audio/ogg",

  // Video
  ".mp4": "video/mp4",
  ".webm": "video/webm",
  ".ogg-video": "video/ogg",
  ".avi": "video/x-msvideo",
  ".mov": "video/quicktime",

  // Application files
  ".pdf": "application/pdf",
  ".zip": "application/zip",
  ".gzip": "application/gzip",
  "javascript-app": "application/javascript",
  ".octet-stream": "application/octet-stream",
  ".tar": "application/x-tar",
  ".rar": "application/vnd.rar",
  ".7z": "application/x-7z-compressed",
  ".exe": "application/vnd.microsoft.portable-executable",
  ".iso": "application/x-iso9660-image",

  // Font files
  ".woff": "font/woff",
  ".woff2": "font/woff2",
  ".ttf": "font/ttf",
  ".otf": "font/otf",
};

export default mimeTypes;
