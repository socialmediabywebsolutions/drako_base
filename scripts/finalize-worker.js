const fs = require('fs');
const path = require('path');

const outputDir = path.resolve('.open-next');
const serverFunctionsDir = path.join(outputDir, 'server-functions', 'default');
const workerDest = path.join(outputDir, '_worker.js');

console.log(`\n🏗️  Finalizing OpenNext Worker for Cloudflare Pages...`);

// 1. Locate Source Worker
const sourceWorker = path.join(serverFunctionsDir, 'index.mjs');

if (!fs.existsSync(sourceWorker)) {
    console.error(`❌ Error: Source worker not found at ${sourceWorker}`);
    console.log('Listing .open-next structure:');
    // Simple recursive list could go here, but let's just fail fast.
    process.exit(1);
}

// 2. File Copy List (Source -> Destination relative to outputDir)
// We move index.mjs -> _worker.js
// And sibling files (middleware.mjs, open-next.config.mjs) -> root files
const filesToCopy = [
    { src: 'index.mjs', dest: '_worker.js', required: true },
    { src: 'middleware.mjs', dest: 'middleware.mjs', required: false }, // Might not exist if no middleware
    { src: 'open-next.config.mjs', dest: 'open-next.config.mjs', required: false },
    { src: 'package.json', dest: 'package.json', required: false } // sometimes needed for resolution
];

filesToCopy.forEach(({ src, dest, required }) => {
    const sourcePath = path.join(serverFunctionsDir, src);
    const destPath = path.join(outputDir, dest);

    if (fs.existsSync(sourcePath)) {
        fs.copyFileSync(sourcePath, destPath);
        console.log(`✅ Copied: ${src} -> ${dest}`);
    } else if (required) {
        console.error(`❌ Error: Required file ${src} not found.`);
        process.exit(1);
    } else {
        console.log(`ℹ️  Optional file ${src} not found (skipping).`);
    }
});

// 3. Verify Assets
const assetsDir = path.join(outputDir, 'assets');
if (!fs.existsSync(assetsDir)) {
    console.error(`❌ Error: Assets directory not found at ${assetsDir}`);
    process.exit(1);
} else {
    console.log(`✅ Assets directory verified.`);
}

// PATCH: Add 'node:' prefix to built-in requires to satisfy Wrangler's bundling
console.log("Patching _worker.js imports for Wrangler compatibility...");
const destWorkerPath = path.join(outputDir, '_worker.js');
let workerContent = fs.readFileSync(destWorkerPath, 'utf8');

// List of Node.js built-ins to prefix
const builtins = [
    'crypto', 'fs', 'path', 'os', 'stream', 'tty', 'util', 'zlib', 'events',
    'buffer', 'url', 'async_hooks', 'net', 'tls', 'diagnostics_channel',
    'vm', 'worker_threads', 'perf_hooks', 'console', 'dgram', 'dns', 'http', 'https', 'http2', 'punycode', 'querystring', 'readline', 'repl', 'string_decoder', 'timers', 'trace_events', 'v8', 'wasi'
];

// Regex to match require("module") and require('module')
const requireRegex = new RegExp(`require\\s*\\(\\s*['"](${builtins.join('|')})['"]\\s*\\)`, 'g');
// Regex to match from "module" and from 'module' (import x from "...", export x from "...", import "...")
const importRegex = new RegExp(`from\\s+['"](${builtins.join('|')})['"]`, 'g');

let patchCount = 0;

workerContent = workerContent.replace(requireRegex, (match, moduleName) => {
    patchCount++;
    return `require("node:${moduleName}")`;
});

workerContent = workerContent.replace(importRegex, (match, moduleName) => {
    patchCount++;
    return `from "node:${moduleName}"`;
});

fs.writeFileSync(destWorkerPath, workerContent);
console.log(`✅ Patched ${patchCount} built-in imports in _worker.js with node: prefix.`);

console.log(`\n🎉 Worker preparation complete. Ready for deployment.`);
