#!/usr/bin/env node
/* eslint-disable no-console */
const { spawnSync } = require("node:child_process");
const fs = require("node:fs");
const path = require("node:path");

const root = process.cwd();
const openNextDir = path.join(root, ".open-next");
const openNextAssets = path.join(openNextDir, "assets");
const openNextWorker = path.join(openNextDir, "worker.js");
const pagesOutput = path.join(root, ".vercel", "output", "static");
const openNextRuntimeDirs = [
  "cloudflare",
  "middleware",
  ".build",
  "server-functions",
];
const requiredRuntimeFiles = [
  "cloudflare/images.js",
  "cloudflare/init.js",
  "cloudflare/skew-protection.js",
  "middleware/handler.mjs",
  ".build/durable-objects/queue.js",
  ".build/durable-objects/sharded-tag-cache.js",
  ".build/durable-objects/bucket-cache-purge.js",
  "server-functions/default/handler.mjs",
];

function scanForNextOnPages() {
  const targets = [
    path.join(root, "package.json"),
    path.join(root, "package-lock.json"),
  ];

  const scanDirs = [
    path.join(root, "docs"),
    path.join(root, "scripts"),
  ];

  for (const dir of scanDirs) {
    if (!fs.existsSync(dir)) continue;
    for (const entry of fs.readdirSync(dir, { withFileTypes: true })) {
      const full = path.join(dir, entry.name);
      if (entry.isDirectory()) continue;
      if (!/\.(md|js|ts|json)$/i.test(entry.name)) continue;
      if (path.resolve(full) === __filename) continue;
      targets.push(full);
    }
  }

  const hits = [];
  for (const file of targets) {
    if (!fs.existsSync(file)) continue;
    const contents = fs.readFileSync(file, "utf8");
    if (contents.includes("next-on-pages")) {
      hits.push(path.relative(root, file));
    }
  }

  if (hits.length > 0) {
    console.error("Release gate failed: next-on-pages references detected in:");
    hits.forEach((file) => console.error(`- ${file}`));
    process.exit(1);
  }
}

function run(command, args) {
  const result = spawnSync(command, args, { stdio: "inherit" });
  if (result.status !== 0) {
    process.exit(result.status ?? 1);
  }
}

scanForNextOnPages();
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
const workerTarget = path.join(pagesOutput, "_worker.js");
fs.copyFileSync(openNextWorker, workerTarget);

for (const dirName of openNextRuntimeDirs) {
  const sourceDir = path.join(openNextDir, dirName);
  const destDir = path.join(pagesOutput, dirName);
  if (!fs.existsSync(sourceDir)) {
    console.error(`Missing OpenNext runtime directory: ${sourceDir}`);
    process.exit(1);
  }
  fs.cpSync(sourceDir, destDir, { recursive: true });
}

if (!fs.existsSync(workerTarget)) {
  console.error("Missing _worker.js in .vercel/output/static");
  process.exit(1);
}

for (const relativePath of requiredRuntimeFiles) {
  const target = path.join(pagesOutput, relativePath);
  if (!fs.existsSync(target)) {
    console.error(`Missing runtime artifact in .vercel/output/static: ${relativePath}`);
    process.exit(1);
  }
}

console.log("OpenNext: OK");
console.log("next-on-pages: NOT FOUND");
console.log("Output dir: .vercel/output/static");
console.log("_worker.js: FOUND");
