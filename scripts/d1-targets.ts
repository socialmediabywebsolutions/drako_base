import fs from 'fs';
import path from 'path';

/**
 * [OLIMPO] D1 Target Doctor
 * Inspects wrangler.toml and wrangler.workers.toml to identify D1 bindings.
 */

function parseWrangler(filePath: string) {
    if (!fs.existsSync(filePath)) return null;
    const content = fs.readFileSync(filePath, 'utf-8');

    const bindings: any[] = [];
    const d1Regex = /\[\[d1_databases\]\]\s*binding\s*=\s*"([^"]+)"\s*database_name\s*=\s*"([^"]+)"\s*database_id\s*=\s*"([^"]+)"/g;

    let match;
    while ((match = d1Regex.exec(content)) !== null) {
        bindings.push({
            binding: match[1],
            name: match[2],
            id: match[3],
            file: path.basename(filePath)
        });
    }

    return bindings;
}

async function main() {
    console.log("🔍 [OLIMPO] Inspecting D1 Configurations...\n");

    const rootWrangler = path.join(process.cwd(), 'wrangler.toml');
    const workersWrangler = path.join(process.cwd(), 'wrangler.workers.toml');

    const allBindings = [
        ...(parseWrangler(rootWrangler) || []),
        ...(parseWrangler(workersWrangler) || [])
    ];

    if (allBindings.length === 0) {
        console.error("❌ No D1 bindings found in wrangler.toml or wrangler.workers.toml");
        process.exit(1);
    }

    console.table(allBindings);

    console.log("\n🚀 Suggested Migration Commands:");
    const primary = allBindings.find(b => b.binding === 'DRACO_DB') || allBindings[0];

    console.log(`\nApply to ${primary.name} (Primary):`);
    console.log(`  npx wrangler d1 migrations apply ${primary.binding} --remote`);

    console.log(`\nVerify Tables in ${primary.name}:`);
    console.log(`  npx wrangler d1 execute ${primary.binding} --remote --command "SELECT name FROM sqlite_master WHERE type='table' ORDER BY name;"`);

    console.log("\n✅ Configuration alignment complete.");
}

main().catch(console.error);
