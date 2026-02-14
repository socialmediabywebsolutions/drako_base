const fs = require('fs');
const path = require('path');

const outputDir = path.resolve('.open-next');
const workerFile = path.join(outputDir, '_worker.js');
const assetsDir = path.join(outputDir, 'assets');

console.log(`\n🔍 Verifying OpenNext output in: ${outputDir}`);

if (!fs.existsSync(workerFile)) {
    console.error(`❌ Error: Worker file not found at ${workerFile}`);
    process.exit(1);
} else {
    console.log(`✅ Worker file found: _worker.js`);
}

if (!fs.existsSync(assetsDir)) {
    console.error(`❌ Error: Assets directory not found at ${assetsDir}`);
    process.exit(1);
} else {
    console.log(`✅ Assets directory found: assets/`);
}

console.log('🎉 OpenNext build verify success!');
