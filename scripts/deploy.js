const { execSync } = require('child_process');
const crypto = require('crypto');
const fs = require('fs');

const env = process.argv[2]; // 'preview', 'staging', 'production'
if (!['preview', 'staging', 'production'].includes(env)) {
    console.error('❌ Error: Environment must be preview, staging, or production');
    process.exit(1);
}

const releaseId = crypto.randomUUID();
let commitHash = 'unknown';
try {
    commitHash = execSync('git rev-parse --short HEAD').toString().trim();
} catch (e) {
    console.warn('⚠️  Git commit hash could not be retrieved.');
}

const timestamp = new Date().toISOString();

console.log(`🚀 Starting Deployment for ${env.toUpperCase()}`);
console.log(`📌 Release ID: ${releaseId}`);
console.log(`🔗 Commit: ${commitHash}`);

// Inject Env Vars for Build
process.env.NEXT_PUBLIC_APP_ENV = env;
process.env.NEXT_PUBLIC_RELEASE_ID = releaseId;
process.env.NEXT_PUBLIC_COMMIT_HASH = commitHash;

let exitCode = 0;

try {
    // 2. Build
    if (process.env.SKIP_BUILD === 'true') {
        console.log('⏩ Skipping Build (Using existing artifacts)...');
    } else {
        console.log('🏗️  Building Worker...');
        execSync('npm run build:worker', { stdio: 'inherit', env: { ...process.env } });
    }

    // 3. Deploy
    console.log('🌎 Deploying to Cloudflare...');

    // Swap wrangler.toml for Pages compatibility
    if (fs.existsSync('wrangler.toml')) {
        if (fs.existsSync('wrangler.worker.toml')) {
            try { fs.unlinkSync('wrangler.worker.toml'); } catch (e) { }
        }
        fs.renameSync('wrangler.toml', 'wrangler.worker.toml');
    }

    if (fs.existsSync('wrangler.pages.toml')) {
        fs.copyFileSync('wrangler.pages.toml', 'wrangler.toml');
    }

    let deployCmd = '';

    if (env === 'preview') {
        deployCmd = `npx wrangler pages deploy .open-next --project-name drako-base-3 --branch preview --commit-hash ${commitHash}`;
    } else if (env === 'staging') {
        deployCmd = `npx wrangler pages deploy .open-next --project-name drako-staging --branch main --commit-hash ${commitHash}`;
    } else if (env === 'production') {
        deployCmd = `npx wrangler pages deploy .open-next --project-name drako-base-3 --branch main --commit-hash ${commitHash}`;
    }

    execSync(deployCmd, { stdio: 'inherit' });
    console.log(`✅ Deployment to ${env} SUCCESS`);

    // 4. Record Release
    const logEntry = JSON.stringify({ releaseId, commitHash, env, timestamp, status: 'success' }) + '\n';
    fs.appendFileSync('release_log.jsonl', logEntry);

} catch (error) {
    console.error(`❌ Deployment Failed: ${error.message}`);
    const logEntry = JSON.stringify({ releaseId, commitHash, env, timestamp, status: 'failure', error: error.message }) + '\n';
    fs.appendFileSync('release_log.jsonl', logEntry);
    exitCode = 1;
} finally {
    // Restore wrangler.toml
    if (fs.existsSync('wrangler.worker.toml')) {
        if (fs.existsSync('wrangler.toml')) {
            try { fs.unlinkSync('wrangler.toml'); } catch (e) { }
        }
        fs.renameSync('wrangler.worker.toml', 'wrangler.toml');
    }
    process.exit(exitCode);
}
