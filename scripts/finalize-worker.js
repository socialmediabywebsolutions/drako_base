const fs = require('fs');
const path = require('path');

const outputDir = path.resolve('.open-next');
const assetsDir = path.join(outputDir, 'assets');
const workerDest = path.join(outputDir, '_worker.js');

console.log(`\n🏗️  Finalizing OpenNext Worker for Cloudflare Pages...`);

// 1. Debug: List .open-next structure
console.log('📂 Scanning .open-next directory structure...');
function listDir(dir, level = 0) {
    if (level > 3) return; // Limit recursion depth
    try {
        const items = fs.readdirSync(dir);
        items.forEach(item => {
            const fullPath = path.join(dir, item);
            const isDir = fs.statSync(fullPath).isDirectory();
            console.log(`${'  '.repeat(level)}${isDir ? '📁' : '📄'} ${item}`);
            if (isDir) listDir(fullPath, level + 1);
        });
    } catch (e) {
        console.warn(`Error listing ${dir}: ${e.message}`);
    }
}
listDir(outputDir);

// 2. Auto-discover Worker Entry
const possibleEntries = [
    path.join(outputDir, 'server-functions', 'default', 'index.mjs'),
    path.join(outputDir, 'server-functions', 'default', 'index.js'),
    path.join(outputDir, 'worker.mjs'),
    path.join(outputDir, 'worker.js')
];

let sourceWorker = null;
for (const entry of possibleEntries) {
    if (fs.existsSync(entry)) {
        sourceWorker = entry;
        break;
    }
}

if (!sourceWorker) {
    console.error(`❌ Error: Could not find worker entry point.`);
    console.error(`Checked locations:`);
    possibleEntries.forEach(p => console.error(` - ${p}`));
    process.exit(1);
}

console.log(`✅ Found worker entry at: ${path.relative(process.cwd(), sourceWorker)}`);

// 3. Guarantee .open-next/_worker.js at root
console.log(`Copying worker to ${workerDest}...`);
fs.copyFileSync(sourceWorker, workerDest);

// 4. Guarantee assets directory
if (!fs.existsSync(assetsDir)) {
    console.error(`❌ Error: .open-next/assets/ directory is missing!`);
    console.error(`OpenNext build failed to generate static assets.`);
    process.exit(1);
}
console.log(`✅ Verified assets directory exists.`);

// 5. Copy dependencies if referenced (middleware, config)
// We optimistically copy them to root as Cloudflare Pages often needs them there for relative imports
const dependencies = [
    'middleware.mjs',
    'open-next.config.mjs'
];

dependencies.forEach(dep => {
    const src = path.join(path.dirname(sourceWorker), dep);
    const dest = path.join(outputDir, dep);
    if (fs.existsSync(src)) {
        fs.copyFileSync(src, dest);
        console.log(`✅ Copied dependency: ${dep}`);
    } else {
        console.log(`ℹ️  Dependency ${dep} not found (optional).`);
    }
});

// 6. PATCH: node: prefix for built-in modules
console.log("🩹 Patching _worker.js imports for Wrangler compatibility...");
let workerContent = fs.readFileSync(workerDest, 'utf8');
const builtins = [
    'crypto', 'fs', 'path', 'os', 'stream', 'tty', 'util', 'zlib', 'events',
    'buffer', 'url', 'async_hooks', 'net', 'tls', 'diagnostics_channel',
    'vm', 'worker_threads', 'perf_hooks', 'console', 'dgram', 'dns', 'http', 'https', 'http2', 'punycode', 'querystring', 'readline', 'repl', 'string_decoder', 'timers', 'trace_events', 'v8', 'wasi'
];

// Regex for require("module")
const requireRegex = new RegExp(`require\\s*\\(\\s*['"](${builtins.join('|')})['"]\\s*\\)`, 'g');
// Regex for from "module" (import/export)
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

fs.writeFileSync(workerDest, workerContent);
console.log(`✅ Patched ${patchCount} built-in imports in _worker.js with node: prefix.`);

console.log(`\n🎉 Worker stabilization complete. Ready for Cloudflare Pages Git Deploy.`);
