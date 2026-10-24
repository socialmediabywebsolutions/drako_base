const fs = require('fs');
const path = require('path');

const outputDir = path.resolve('.open-next');
const source = path.join(outputDir, 'server-functions', 'default', 'index.mjs');
const dest = path.join(outputDir, '_worker.js');

console.log(`\n📋 Adapter: Copying worker to root...`);

if (fs.existsSync(source)) {
    fs.copyFileSync(source, dest);
    console.log(`✅ Copied: ${source} -> ${dest}`);
} else {
    console.warn(`⚠️ Source worker not found at ${source}. Checking if _worker.js already exists...`);
    if (!fs.existsSync(dest)) {
        console.error(`❌ Error: Neither source worker nor _worker.js found.`);
        process.exit(1);
    }
}
