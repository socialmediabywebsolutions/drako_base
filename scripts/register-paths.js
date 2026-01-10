const Module = require("module");
const path = require("path");

const originalResolve = Module._resolveFilename;
const originalLoad = Module._load;

function findRepoRoot(startDir) {
  let dir = startDir;
  while (dir && dir !== path.parse(dir).root) {
    if (require("fs").existsSync(path.join(dir, "package.json"))) {
      return dir;
    }
    dir = path.dirname(dir);
  }
  return startDir;
}

const repoRoot = findRepoRoot(__dirname);
const distRoot = path.join(repoRoot, "scripts", ".dist", "src");
const srcRoot = path.join(repoRoot, "src");
const nextOnPagesShimDist = path.join(repoRoot, "scripts", ".dist", "scripts", "shims", "next-on-pages.js");
const nextOnPagesShimSrc = path.join(repoRoot, "scripts", "shims", "next-on-pages.ts");

Module._resolveFilename = function resolveFilename(request, parent, isMain, options) {
  if (request === "@cloudflare/next-on-pages") {
    const target = require("fs").existsSync(nextOnPagesShimDist) ? nextOnPagesShimDist : nextOnPagesShimSrc;
    return originalResolve.call(this, target, parent, isMain, options);
  }
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
  return originalLoad(request, parent, isMain);
};
