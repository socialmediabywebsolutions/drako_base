#!/usr/bin/env node

/**
 * Preflight check: verifies required dependency Workers exist in the
 * Cloudflare account BEFORE attempting to deploy the main worker.
 *
 * Usage:  node scripts/preflight-deploy.js
 * Exit 0 = all deps exist, safe to deploy main.
 * Exit 1 = missing dependencies, do NOT deploy main.
 *
 * Requires: CLOUDFLARE_API_TOKEN and CLOUDFLARE_ACCOUNT_ID env vars.
 */

const REQUIRED_WORKERS = [
    "drako-scheduler",
    "saas-factory-worker",
];

async function checkWorkerExists(accountId, apiToken, workerName) {
    const url = `https://api.cloudflare.com/client/v4/accounts/${accountId}/workers/scripts/${workerName}`;
    const res = await fetch(url, {
        headers: { Authorization: `Bearer ${apiToken}` },
    });
    return res.ok;
}

async function main() {
    const apiToken = process.env.CLOUDFLARE_API_TOKEN;
    const accountId = process.env.CLOUDFLARE_ACCOUNT_ID;

    if (!apiToken || !accountId) {
        console.error("[preflight] Missing CLOUDFLARE_API_TOKEN or CLOUDFLARE_ACCOUNT_ID");
        process.exit(1);
    }

    console.log("[preflight] Checking required dependency Workers...");

    let allOk = true;
    for (const name of REQUIRED_WORKERS) {
        const exists = await checkWorkerExists(accountId, apiToken, name);
        if (exists) {
            console.log(`  ✅ ${name}`);
        } else {
            console.error(`  ❌ MISSING: ${name}`);
            allOk = false;
        }
    }

    if (!allOk) {
        console.error("\n[preflight] BLOCKED: Deploy missing Workers first.");
        console.error("  npm run deploy:scheduler       # drako-scheduler");
        console.error("  npm run deploy:saas-factory     # saas-factory-worker");
        process.exit(1);
    }

    console.log("[preflight] All dependency Workers verified. Safe to deploy main.");
}

main();
