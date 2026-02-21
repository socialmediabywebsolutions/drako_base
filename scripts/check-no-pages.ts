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
