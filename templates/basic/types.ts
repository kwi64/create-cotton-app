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

  type MetaName = "description" | "keywords" | "author" | "viewport";

  type PageMeta = {
    [key in MetaName]?: string;
  };

  type RouteKey = `/${string}`;

  type LoaderFile = `${string}.loader${".js" | ".ts" | ""}`;

  type Routes = {
    [key: RouteKey]: {
      group?: string;
      name?: string;
      page?: string;
      loader?: LoaderFile;
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

  interface CottonData {
    route: {
      key: string;
      name: string | undefined;
      group: string | undefined;
      params: {};
    };
    loader: {} | undefined;
  }

  type CottonLoader = {
    (): any | Promise<any>;
  };
}
