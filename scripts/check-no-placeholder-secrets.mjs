import fs from "node:fs";
import path from "node:path";

const ROOT = process.cwd();
const filesToCheck = [path.join(ROOT, "wrangler.workers.toml")];
const placeholderPatterns = [
  /temp_secret_change_me_in_dashboard/g,
];

const offenders = [];

for (const filePath of filesToCheck) {
  const content = fs.readFileSync(filePath, "utf8");
  for (const pattern of placeholderPatterns) {
    if (pattern.test(content)) {
      offenders.push(path.relative(ROOT, filePath));
      break;
    }
  }
}

if (offenders.length > 0) {
  console.error("PLACEHOLDER_SECRETS_BLOCKED");
  for (const offender of offenders) {
    console.error(`- ${offender}`);
  }
  process.exit(1);
}
