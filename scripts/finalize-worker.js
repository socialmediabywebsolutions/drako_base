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

console.log(`\n🎉 Worker preparation complete. Ready for deployment.`);
