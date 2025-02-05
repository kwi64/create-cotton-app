declare module "*.module.css" {
  const classes: { [key: string]: string };
  export default classes;
}

declare module "cottonjs" {
  import { IncomingMessage, ServerResponse } from "http";
  import { PluginBuild } from "esbuild";

  type SyncOrAsync<T> = T | Promise<T>;

  interface IPCMessage {
    status: "done" | "error";
  }

  interface RequestExtensions {
    [name: string]: (this: IncomingMessage, ...args: any[]) => Promise<any>;
  }

  interface EsBuildPlugins {
    [name: string]: {
      name: string;
      setup: (build: PluginBuild) => void;
    };
  }

  interface RequestExtensionsMap {
    getQuery(): Promise<{}>;
    getBody(): Promise<any>;
  }

  type RouteKey = `/${string}`;

  type Routes = {
    [key: RouteKey]: {
      name?: string;
      page?: string;
      loader?: string;
    };
  };

  class _WebSocket extends WebSocket {}
  interface WebSocket extends _WebSocket {
    url_path: string;
  }

  interface FormattedMiddlewareResponse {
    allow: boolean;
    code?: number;
    message?: string;
    contentType?: string;
  }

  type MiddewareResponse = FormattedMiddlewareResponse | string | boolean;

  interface Middleware {
    (
      req: RequestExtensionsMap & IncomingMessage
    ): SyncOrAsync<MiddewareResponse>;
  }

  interface Endpoint {
    method?: "GET" | "POST" | "PUT" | "DELETE";
    response: (args: {
      req: RequestExtensionsMap & IncomingMessage;
      res: ServerResponse;
    }) => SyncOrAsync<void>;
    middleware?: Middleware;
  }

  interface MIMEType {
    [key: string]: string;
  }

  interface CottonPageParams {
    cotton: {
      route: string;
      route_name: string | undefined;
      route_params: {};
    };
    loader: {} | undefined;
  }

  type CottonLoader = {
    (): any | Promise<any>;
  };
}
