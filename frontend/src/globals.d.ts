import type * as AppBindings from "../wailsjs/go/main/App";
import type * as HandlerBindings from "../wailsjs/go/wailsapi/Handler";

declare global {
  interface Window {
    go?: {
      main?: {
        App?: typeof AppBindings;
        Handler?: typeof HandlerBindings;
      };
      wailsapi?: {
        Handler?: typeof HandlerBindings;
      };
    };
    runtime?: unknown;
  }
}

declare module "*.css" {}

export {};
