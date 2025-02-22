/**
 * Type declaration for CSS Modules imports.
 *
 * Example usage:
 * import styles from "./Home.module.css";
 *
 * `${styles.className}`
 */
declare module "*.module.css" {
  const classes: { [key: string]: string };
  export default classes;
}

/**
 * Main type declaration file for the "cottonjs" module.
 */
declare module "cottonjs" {
  import { IncomingMessage, ServerResponse } from "http";
  import { PluginBuild } from "esbuild";

  /**
   * A utility type for functions/methods that may return either a value of type `T`
   * or a Promise resolving to type `T`.
   */
  type SyncOrAsync<T> = T | Promise<T>;

  /**
   * Represents the structure of an IPC (Inter-Process Communication) Message,
   * used to communicate status updates or errors between processes.
   */
  interface IPCMessage {
    status: "done" | "error";
  }

  /**
   * Represents a map of request extension functions.
   *
   * Example usage:
   * req.someExtension(...args);
   */
  interface HttpRequestExtensions {
    [name: string]: (this: IncomingMessage, ...args: any[]) => Promise<any>;
  }

  /**
   * A collection of ESBuild plugin objects, each with a `setup` method that ties into ESBuild’s plugin system.
   */
  interface EsBuildPlugins {
    [name: string]: {
      /**
       * The name of the plugin.
       */
      name: string;
      /**
       * A function that ESBuild calls to set up the plugin’s behavior.
       */
      setup: (build: PluginBuild) => void;
    };
  }

  /**
   * A map of functions that extend the default `IncomingMessage` interface,
   * providing additional helper methods to parse queries, bodies, etc.
   */
  interface RequestExtensionsMap {
    /**
     * Asynchronously returns the parsed URL query parameters from the request.
     */
    getQuery(): Promise<{}>;
    /**
     * Asynchronously returns the parsed body of the request.
     */
    getBody(): Promise<any>;
  }

  /**
   * A union of allowable meta tag names for an HTML page.
   */
  type MetaName = "description" | "keywords" | "author" | "viewport";

  /**
   * Represents an object containing meta tag names mapped to their string values.
   *
   * Example usage:
   * const pageMeta: PageMeta = {
   *   description: "Cotton JS - A React SSR framework built with Node's http module",
   *   keywords: "CottonJS, SSR"
   * };
   */
  type PageMeta = {
    [key in MetaName]?: string;
  };

  /**
   * A route key represents the path in your application (starting with a slash).
   *
   * Example: "/login", "/users/profile"
   */
  type RouteKey = `/${string}`;

  /**
   * A loader file pattern, e.g. "Home.loader.js", "Home.loader.ts", or "Home.loader".
   */
  type LoaderFile = `${string}.loader${".js" | ".ts" | ""}`;

  /**
   * Represents a mapping of routes to their respective configuration.
   *
   * Each key is a `RouteKey`,
   * and the value object optionally contains:
   *   - group: group name for grouping routes
   *   - name: a human-friendly route name
   *   - page: the location of the page component
   *   - loader: the location of the loader file
   */
  type Routes = {
    [key: RouteKey]: {
      group?: string;
      name?: string;
      page?: string;
      loader?: LoaderFile;
    };
  };

  /**
   * Extension of the WebSocket class adding a `url_path` property.
   */
  class _WebSocket extends WebSocket {}
  interface WebSocket extends _WebSocket {
    /**
     * The path that the WebSocket is associated with (e.g. "/home").
     */
    url_path: string;
  }

  /**
   * Formatted middleware response format.
   */
  interface FormattedMiddlewareResponse {
    /**
     * Determines whether the request is allowed to proceed.
     */
    allow: boolean;

    /**
     * The HTTP status code returned if `allow` is `false`.
     */
    code?: number;

    /**
     * A message describing why the request was disallowed.
     */
    message?: string;

    /**
     * Optional content type for the response.
     */
    contentType?: string;
  }

  /**
   * Possible return types for a middleware function.
   *
   * - A `FormattedMiddlewareResponse` for structured data.
   * - A `string` for a simple error or redirect message.
   * - A `boolean` to indicate allowed (true) or disallowed (false).
   */
  type MiddlewareResponse = FormattedMiddlewareResponse | string | boolean;

  /**
   * A middleware function that takes an augmented `IncomingMessage`
   * and returns a synchronous or asynchronous `MiddlewareResponse`.
   */
  interface Middleware {
    (
      req: RequestExtensionsMap & IncomingMessage
    ): SyncOrAsync<MiddlewareResponse>;
  }

  /**
   * Defines a route endpoint within the application, which includes:
   *
   * - `method`: HTTP method for the route (default: "GET").
   * - `response`: a function that handles the incoming request and sends a response.
   * - `middleware`: an optional middleware function to run before `response` is called.
   */
  interface Endpoint {
    /**
     * The HTTP method for the endpoint (e.g. GET, POST, PUT, DELETE).
     */
    method?: "GET" | "POST" | "PUT" | "DELETE";

    /**
     * The core function for handling the request and response.
     */
    response: (args: {
      req: RequestExtensionsMap & IncomingMessage;
      res: ServerResponse;
    }) => SyncOrAsync<void>;

    /**
     * Optional middleware that runs before `response` is called.
     */
    middleware?: Middleware;
  }

  /**
   * Maps file extensions (like ".js" or ".css") to their MIME types.
   */
  interface MIMEType {
    [key: string]: string;
  }

  /**
   * Cotton data received as page props, containing:
   *   - route: Information about the current route
   *   - loader: Loader output, if any
   */
  interface CottonData {
    route: {
      key: string;
      name: string | undefined;
      group: string | undefined;
      params: {};
    };
    loader: {} | undefined;
  }

  /**
   * Represents a loader function for retrieving data (e.g.,
   * from a database or external API) before rendering a page.
   */
  type CottonLoader = {
    (): any | Promise<any>;
  };
}
