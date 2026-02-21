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

console.log(`🚀 Starting Solo-Worker Deployment for ${env.toUpperCase()}`);
console.log(`📌 Release ID: ${releaseId}`);
console.log(`🔗 Commit: ${commitHash}`);

// Inject Env Vars
process.env.NEXT_PUBLIC_APP_ENV = env;
process.env.NEXT_PUBLIC_RELEASE_ID = releaseId;
process.env.NEXT_PUBLIC_COMMIT_HASH = commitHash;

let exitCode = 0;

try {
    // 1. Guardrail Check
    if (fs.existsSync('wrangler.toml') || fs.existsSync('wrangler.pages.toml')) {
        console.error('❌ ERROR: Legacy Pages configs detected (wrangler.toml or wrangler.pages.toml).');
        console.error('💡 This project has migrated to Solo-Worker. Please use wrangler.workers.toml.');
        process.exit(1);
    }

    // 2. Build
    if (process.env.SKIP_BUILD === 'true') {
        console.log('⏩ Skipping Build...');
    } else {
        console.log('🏗️  Building Worker artifacts...');
        execSync('npm run build:worker', { stdio: 'inherit', env: { ...process.env } });
    }

    // 3. Deploy
    console.log('🌎 Deploying to Cloudflare Workers (Solo-Worker)...');

    let deployCmd = `npx wrangler deploy --config wrangler.workers.toml`;

    // Si es preview, podemos usar el entorno definido en toml
    if (env === 'preview') {
        deployCmd += ` --env preview`;
    }

    execSync(deployCmd, { stdio: 'inherit' });
    console.log(`✅ Solo-Worker Deployment to ${env} SUCCESS`);

    // 4. Record Release
    const logEntry = JSON.stringify({ releaseId, commitHash, env, timestamp, status: 'success' }) + '\n';
    fs.appendFileSync('release_log.jsonl', logEntry);

} catch (error) {
    console.error(`❌ Deployment Failed: ${error.message}`);
    const logEntry = JSON.stringify({ releaseId, commitHash, env, timestamp, status: 'failure', error: error.message }) + '\n';
    fs.appendFileSync('release_log.jsonl', logEntry);
    exitCode = 1;
} finally {
    process.exit(exitCode);
}
