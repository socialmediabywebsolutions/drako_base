const fs = require('fs');
const path = require('path');

const outputDir = path.resolve('.open-next');
const assetsDir = path.join(outputDir, 'assets');
const finalWorkerDest = path.join(outputDir, 'worker.js');

console.log(`\n🏗️  Finalizing OpenNext Worker for Solo-Worker Architecture...`);

// ==============================================================================
// 1. Auto-discover Worker Entry
// ==============================================================================
// Priority order as requested:
// 1. .open-next/_worker.js (already patched or generated)
// 2. .open-next/worker.js
// 3. .open-next/server-functions/default/index.mjs
// 4. Any index.mjs in server-functions (fallback)

const possibleEntries = [
    path.join(outputDir, '_worker.js'),
    path.join(outputDir, 'worker.js'),
    path.join(outputDir, 'server-functions', 'default', 'index.mjs')
];

// Add dynamic fallback for any index.mjs in server-functions
const serverFnDir = path.join(outputDir, 'server-functions');
if (fs.existsSync(serverFnDir)) {
    const subdirs = fs.readdirSync(serverFnDir);
    subdirs.forEach(d => {
        const entry = path.join(serverFnDir, d, 'index.mjs');
        if (!possibleEntries.includes(entry)) {
            possibleEntries.push(entry);
        }
    });
}

let sourceWorker = null;
for (const entry of possibleEntries) {
    if (fs.existsSync(entry)) {
        // Special case: valid input is _worker.js itself (re-running script) 
        // We only use it if it's not the target destination to avoid read-write overlap issues 
        // (unless we handle it carefully, which we will by reading content first)
        sourceWorker = entry;
        break;
    }
}

if (!sourceWorker) {
    console.error(`❌ Error: Could not find worker entry point.`);
    console.error(`Checked locations:`);
    possibleEntries.forEach(p => console.error(` - ${path.relative(process.cwd(), p)}`));
    process.exit(1);
}

console.log(`✅ Found worker entry at: ${path.relative(process.cwd(), sourceWorker)}`);

// Read content immediately to avoid issues if source == dest
let workerContent = fs.readFileSync(sourceWorker, 'utf8');


// ==============================================================================
// 2. Copy Dependencies (Middleware, Config)
// ==============================================================================
// Ensure these exist at root .open-next/ if the worker imports them relatively.
// We scan for relative imports to be smart, or just opportunistic copy.
// User requirement: "Asegurar que estos archivos existan en la raíz"

const dependencies = [
    'middleware.mjs',
    'open-next.config.mjs'
];

dependencies.forEach(dep => {
    // Check if it exists in the source directory (e.g. server-functions/default/)
    const srcPath = path.join(path.dirname(sourceWorker), dep);
    const rootDest = path.join(outputDir, dep);

    if (fs.existsSync(srcPath)) {
        if (srcPath !== rootDest) {
            fs.copyFileSync(srcPath, rootDest);
            console.log(`✅ Copied dependency to root: ${dep}`);
        }
    } else {
        // It might already be at root if sourceWorker was at root, or just missing.
        // If missing at source, check if it's already at root?
        if (fs.existsSync(rootDest)) {
            console.log(`ℹ️  Dependency ${dep} already present at root.`);
        } else {
            console.log(`ℹ️  Dependency ${dep} not found (skipped).`);
        }
    }
});


// ==============================================================================
// 3. Patching Anti-Bundler (Node Built-ins)
// ==============================================================================
console.log("🩹 Patching worker.js imports for Wrangler compatibility...");

const builtins = [
    'crypto', 'fs', 'path', 'stream', 'util', 'zlib', 'buffer', 'process', 'os',
    'url', 'events', 'timers', 'module', 'http', 'https', 'net', 'tls', 'child_process',
    'dgram', 'dns', 'perf_hooks', 'punycode', 'querystring', 'readline', 'repl', 'string_decoder', 'trace_events', 'v8', 'vm', 'wasi', 'worker_threads'
];

let totalPatches = 0;
const patchStats = {};

builtins.forEach(mod => {
    // Regex for require("module") or require('module')
    // We strictly look for "module" or 'module' with surrounding quotes and optional whitespace
    const requireRegex = new RegExp(`require\\s*\\(\\s*['"]${mod}['"]\\s*\\)`, 'g');

    // Regex for from "module" (valid in import ... from "..." or export ... from "...")
    const importRegex = new RegExp(`from\\s+['"]${mod}['"]`, 'g');

    let modPatches = 0;

    workerContent = workerContent.replace(requireRegex, (match) => {
        modPatches++;
        totalPatches++;
        return `require("node:${mod}")`;
    });

    workerContent = workerContent.replace(importRegex, (match) => {
        modPatches++;
        totalPatches++;
        return `from "node:${mod}"`;
    });

    if (modPatches > 0) {
        patchStats[mod] = modPatches;
    }
});

// Write the finally patched content to .open-next/_worker.js (root)
fs.writeFileSync(finalWorkerDest, workerContent);

console.log(`✅ Patched ${totalPatches} built-in imports.`);
if (totalPatches > 0) {
    console.table(patchStats);
}


// ==============================================================================
// 4. Verification
// ==============================================================================

// A) Assets
if (!fs.existsSync(assetsDir)) {
    console.error(`❌ Error: .open-next/assets/ directory is missing!`);
    console.error(`Build failed: Static assets not found.`);
    process.exit(1);
}

// B) Worker existence
if (!fs.existsSync(finalWorkerDest)) {
    console.error(`❌ Error: .open-next/worker.js was not created!`);
    process.exit(1);
}

// C) Tree Summary
console.log('\n📂 Final .open-next/ structure:');
function printTree(dir, prefix = '') {
    if (prefix.length > 10) return; // safety depth
    try {
        const items = fs.readdirSync(dir);
        items.forEach((item, index) => {
            const isLast = index === items.length - 1;
            const fullPath = path.join(dir, item);
            const isDir = fs.statSync(fullPath).isDirectory();

            const connector = isLast ? '└── ' : '├── ';
            console.log(`${prefix}${connector}${item}${isDir ? '/' : ''}`);

            if (isDir) {
                const newPrefix = prefix + (isLast ? '    ' : '│   ');
                // Don't recurse too deep into node_modules or huge assets
                if (item !== 'node_modules' && item !== 'assets') {
                    printTree(fullPath, newPrefix);
                } else if (item === 'assets') {
                    // Briefly summarize assets
                    const assetCount = fs.readdirSync(fullPath).length;
                    console.log(`${newPrefix}└── (... ${assetCount} files)`);
                }
            }
        });
    } catch (e) {
        console.log(`${prefix}Error reading dir: ${e.message}`);
    }
}

printTree(outputDir);

console.log(`\n🎉 Worker stabilization complete. Ready for Cloudflare Solo-Worker Deploy.`);
