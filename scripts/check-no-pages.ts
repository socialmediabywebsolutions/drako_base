import { existsSync } from 'fs';
import { exit } from 'process';

/**
 * Solo-Worker Guardrail
 * Fails the build if legacy Pages configuration files are detected in an active state.
 */

const forbiddenFiles = [
    'wrangler.toml',
    'wrangler.pages.toml',
];

console.log('🛡️ Running Solo-Worker Guardrail...');

const pagesVars = [
    'CF_PAGES',
    'CF_PAGES_ENVIRONMENT',
    'CF_PAGES_BRANCH',
    'CF_PAGES_COMMIT_SHA',
    'CF_PAGES_URL',
    'CF_PAGES_BUILD_ID',
];

const detectedPagesVars = pagesVars.filter((key) => Boolean(process.env[key]));
if (detectedPagesVars.length > 0) {
    console.error(
        `❌ ERROR: Cloudflare Pages environment detected (${detectedPagesVars.join(', ')}). This repo is Workers-only and must NOT be deployed on Pages.`
    );
    exit(1);
}

let detected = false;
forbiddenFiles.forEach(file => {
    if (existsSync(file)) {
        console.error(`❌ ERROR: Legacy config file "${file}" detected. This project has migrated to Solo-Worker architecture (wrangler.workers.toml).`);
        detected = true;
    }
});

if (detected) {
    console.log('\n💡 Please ensure all legacy configs are renamed to .legacy or removed.');
    exit(1);
}

console.log('✅ Guardrail passed. No legacy Pages configs found.');
exit(0);
