import fs from "fs";
import path from "path";
import { renderInventoryMarkdown, runAuthSsotDriftChecks } from "./lib/auth-ssot-audit";

function parseArgs(argv: string[]) {
  return {
    writeReport: argv.includes("--report") || argv.includes("--write-report"),
    failOnWarnings: argv.includes("--strict"),
  };
}

async function main() {
  const args = parseArgs(process.argv.slice(2));
  const projectRoot = process.cwd();
  const reportPath = path.join(projectRoot, "docs/reports/p1-auth-inventory.md");

  const result = runAuthSsotDriftChecks(projectRoot);
  const markdown = renderInventoryMarkdown(result.inventory);

  if (args.writeReport) {
    fs.mkdirSync(path.dirname(reportPath), { recursive: true });
    fs.writeFileSync(reportPath, markdown, "utf8");
    console.log(`AUTH_INVENTORY_REPORT_WRITTEN ${path.relative(projectRoot, reportPath)}`);
  }

  if (!result.ok) {
    console.error("AUTH_SSOT_DRIFT_DETECTED");
    for (const err of result.errors) {
      console.error(` - ${err}`);
    }
    process.exit(1);
  }

  if (args.failOnWarnings && result.inventory.crossRedirects.length > 0) {
    process.exit(1);
  }

  console.log("AUTH_SSOT_OK");
}

main().catch((error) => {
  console.error("AUTH_SSOT_SCRIPT_FAILED", error);
  process.exit(1);
});
