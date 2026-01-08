import Module from "module";
import path from "node:path";

const shimPath = path.join(__dirname, "next-on-pages.js");
const mod: any = Module;
const originalResolve = mod._resolveFilename.bind(Module);

mod._resolveFilename = function (request: any, parent: any, isMain: any, options: any) {
  if (request === "@cloudflare/next-on-pages") {
    return shimPath;
  }
  return originalResolve(request, parent, isMain, options);
};
