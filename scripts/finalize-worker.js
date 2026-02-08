const fs = require('fs');
const path = require('path');

const src = path.join(process.cwd(), '.open-next', 'worker.js');
const destRoot = path.join(process.cwd(), '.open-next', '_worker.js');
const destAssets = path.join(process.cwd(), '.open-next', 'assets', '_worker.js');

console.log('🏗️  Finalizing Cloudflare Worker Artifacts...');

if (fs.existsSync(src)) {
    // 1. Copy to Root (Correct for Pages with correct output dir)
    fs.copyFileSync(src, destRoot);
    console.log(`✅ Copied worker to ${destRoot}`);

    // 2. Ensure assets dir exists
    const assetsDir = path.dirname(destAssets);
    if (!fs.existsSync(assetsDir)) {
        fs.mkdirSync(assetsDir, { recursive: true });
    }

    // 3. Copy to assets (Safe fallback if config points to assets)
    fs.copyFileSync(src, destAssets);
    console.log(`✅ Copied worker to ${destAssets}`);

    console.log('🚀 Worker artifacts ready for deployment.');
} else {
    console.error('❌ Error: .open-next/worker.js not found. OpenNext build might have failed.');
    process.exit(1);
}
