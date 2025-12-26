const Module = require("module");
const path = require("path");

const originalResolve = Module._resolveFilename;
const originalLoad = Module._load;
const distRoot = path.join(__dirname, ".dist", "src");
const srcRoot = path.join(__dirname, "..", "src");

Module._resolveFilename = function resolveFilename(request, parent, isMain, options) {
  if (typeof request === "string" && request.startsWith("@/")) {
    const rel = request.slice(2);
    const distPath = path.join(distRoot, rel);
    const srcPath = path.join(srcRoot, rel);
    const mapped = require("fs").existsSync(`${distPath}.js`) ? distPath : srcPath;
    return originalResolve.call(this, mapped, parent, isMain, options);
  }
  return originalResolve.call(this, request, parent, isMain, options);
};

Module._load = function load(request, parent, isMain) {
  if (request === "@cloudflare/next-on-pages") {
    return {
      getRequestContext() {
        return { env: null };
      },
    };
  }
  return originalLoad(request, parent, isMain);
};
