#!/usr/bin/env node
/* eslint-disable no-console */
const { spawnSync } = require("node:child_process");
const fs = require("node:fs");
const path = require("node:path");

const root = process.cwd();
const openNextDir = path.join(root, ".open-next");
const openNextAssets = path.join(openNextDir, "assets");
const openNextWorker = path.join(openNextDir, "worker.js");
const pagesOutput = path.join(root, ".pages-output");

function run(command, args) {
  const result = spawnSync(command, args, { stdio: "inherit" });
  if (result.status !== 0) {
    process.exit(result.status ?? 1);
  }
}

run("npm", ["run", "build:cloudflare"]);

if (!fs.existsSync(openNextAssets) || !fs.existsSync(openNextWorker)) {
  console.error("OpenNext output missing. Expected .open-next/assets and .open-next/worker.js.");
  process.exit(1);
}

if (fs.existsSync(pagesOutput)) {
  fs.rmSync(pagesOutput, { recursive: true, force: true });
}
fs.mkdirSync(pagesOutput, { recursive: true });

fs.cpSync(openNextAssets, pagesOutput, { recursive: true });
fs.copyFileSync(openNextWorker, path.join(pagesOutput, "_worker.js"));

console.log("Pages output ready at .pages-output");
