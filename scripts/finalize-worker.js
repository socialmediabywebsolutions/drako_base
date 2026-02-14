const fs = require('fs');
const path = require('path');

console.log('🏗️  Finalizing Cloudflare Worker Artifacts...\n');

const openNextDir = path.join(process.cwd(), '.open-next');

// List .open-next directory contents for debugging
console.log('📂 Listing .open-next directory structure:');
function listDir(dir, prefix = '') {
    try {
        const items = fs.readdirSync(dir);
        items.forEach(item => {
            const itemPath = path.join(dir, item);
            const stats = fs.statSync(itemPath);
            if (stats.isDirectory()) {
                console.log(`${prefix}📁 ${item}/`);
                if (item !== 'node_modules' && item !== '.next') {
                    listDir(itemPath, prefix + '  ');
                }
            } else {
                const sizeKB = (stats.size / 1024).toFixed(2);
                console.log(`${prefix}📄 ${item} (${sizeKB} KB)`);
            }
        });
    } catch (err) {
        console.log(`${prefix}❌ Error reading ${dir}: ${err.message}`);
    }
}
listDir(openNextDir);

console.log('\n🔍 Searching for worker entry point...');

// Search for worker files in priority order
const workerCandidates = [
    path.join(openNextDir, 'worker.js'),
    path.join(openNextDir, 'worker.mjs'),
    path.join(openNextDir, '_worker.js'),
    path.join(openNextDir, 'server-functions', 'default', 'index.mjs'),
    path.join(openNextDir, 'server-functions', 'default', 'worker.mjs'),
];

// Recursively search for worker-like files as fallback
function findWorkerFiles(dir, files = []) {
    try {
        const items = fs.readdirSync(dir);
        items.forEach(item => {
            const itemPath = path.join(dir, item);
            const stats = fs.statSync(itemPath);
            if (stats.isDirectory() && item !== 'node_modules' && item !== 'assets' && item !== 'cache') {
                findWorkerFiles(itemPath, files);
            } else if (stats.isFile() && /^(_?worker|index)\.(m?js)$/.test(item)) {
                files.push(itemPath);
            }
        });
    } catch (err) {
        // Ignore errors
    }
    return files;
}

const autoDiscoveredWorkers = findWorkerFiles(openNextDir);

let workerSource = null;

// Check priority candidates first
for (const candidate of workerCandidates) {
    if (fs.existsSync(candidate)) {
        workerSource = candidate;
        console.log(`✅ Found worker at priority location: ${path.relative(process.cwd(), candidate)}`);
        break;
    }
}

// If not found in priority locations, use auto-discovery
if (!workerSource && autoDiscoveredWorkers.length > 0) {
    workerSource = autoDiscoveredWorkers[0];
    console.log(`⚠️  No worker in priority locations, using auto-discovered: ${path.relative(process.cwd(), workerSource)}`);
    if (autoDiscoveredWorkers.length > 1) {
        console.log(`   Other candidates found: ${autoDiscoveredWorkers.slice(1).map(f => path.relative(process.cwd(), f)).join(', ')}`);
    }
}

if (!workerSource) {
    console.error('\n❌ ERROR: No worker entry point found!');
    console.error('\nExpected locations:');
    workerCandidates.forEach(c => console.error(`  - ${path.relative(process.cwd(), c)}`));
    console.error('\nOpenNext build may have failed or changed its output structure.');
    console.error('Check the directory listing above for actual contents.');
    process.exit(1);
}

// Cloudflare Pages expects _worker.js at the root of the output directory
const destRoot = path.join(openNextDir, '_worker.js');

try {
    // If source and dest are the same, don't copy
    if (path.relative(workerSource, destRoot) !== '') {
        fs.copyFileSync(workerSource, destRoot);
        console.log(`\n✅ Copied worker to: ${path.relative(process.cwd(), destRoot)}`);
    } else {
        console.log(`\n✅ Worker already at correct location: ${path.relative(process.cwd(), destRoot)}`);
    }
} catch (err) {
    console.error(`\n❌ Error copying worker: ${err.message}`);
    process.exit(1);
}

// Verify assets directory exists (required by Cloudflare Pages)
const assetsDir = path.join(openNextDir, 'assets');
if (!fs.existsSync(assetsDir)) {
    console.error('\n❌ ERROR: .open-next/assets directory missing!');
    console.error('   Cloudflare Pages requires static assets in this location.');
    process.exit(1);
}

console.log(`✅ Assets directory verified: ${path.relative(process.cwd(), assetsDir)}`);

// Final verification
const finalWorker = path.join(openNextDir, '_worker.js');
const stats = fs.statSync(finalWorker);
console.log(`\n🚀 Worker artifacts ready for Cloudflare Pages deployment!`);
console.log(`   Worker size: ${(stats.size / 1024).toFixed(2)} KB`);
console.log(`   Output dir: ${path.relative(process.cwd(), openNextDir)}`);
