// pino ships no type declarations for its browser build; it exposes the same
// factory as the main entry.
declare module "pino/browser.js" {
  import type { pino, stdSerializers } from "pino";

  const pinoBrowser: typeof pino & { stdSerializers: typeof stdSerializers };
  export default pinoBrowser;
}
