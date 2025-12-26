import fs from "fs";
import path from "path";

type PolicyEntry = {
  route: string;
  purpose: string;
  consumer: string;
  risk: string;
  mitigations: string[];
};

type Policy = {
  publicOk: PolicyEntry[];
  mustAuth: { route: string; reason?: string }[];
};

const root = process.cwd();
const apiRoot = path.join(root, "src", "app", "api");
const policyPath = path.join(root, "src", "lib", "security", "public-endpoints-policy.json");
const outputPath = path.join(root, "docs", "security", "public-endpoints.md");

function walk(dir: string, result: string[] = []): string[] {
  const entries = fs.readdirSync(dir, { withFileTypes: true });
  for (const entry of entries) {
    const fullPath = path.join(dir, entry.name);
    if (entry.isDirectory()) {
      walk(fullPath, result);
    } else if (entry.isFile() && entry.name === "route.ts") {
      result.push(fullPath);
    }
  }
  return result;
}

function toRoute(filePath: string): string {
  const rel = path.relative(apiRoot, filePath).replace(/\\/g, "/");
  const routePath = rel.replace(/\/route\.ts$/, "");
  return `/api/${routePath}`;
}

function isPublicRoute(filePath: string): boolean {
  const content = fs.readFileSync(filePath, "utf8");
  const guards = [
    /requireTenantAccess/, 
    /requireAdmin/, 
    /requireOwner/, 
    /requireSession/
  ];
  return !guards.some((guard) => guard.test(content));
}

function ensureDocsDir() {
  const dir = path.dirname(outputPath);
  if (!fs.existsSync(dir)) {
    fs.mkdirSync(dir, { recursive: true });
  }
}

function buildMarkdown(policy: Policy, publicRoutes: string[]): string {
  const lines: string[] = [];
  lines.push("# Public endpoints inventory");
  lines.push("");
  lines.push(`Generated: ${new Date().toISOString()}`);
  lines.push("");
  lines.push("## PUBLIC_OK");
  lines.push("");
  lines.push("| Route | Purpose | Consumer | Risk | Mitigations |");
  lines.push("| --- | --- | --- | --- | --- |");
  for (const entry of policy.publicOk) {
    lines.push(
      `| ${entry.route} | ${entry.purpose} | ${entry.consumer} | ${entry.risk} | ${entry.mitigations.join(", ")} |`,
    );
  }
  lines.push("");
  lines.push("## MUST_AUTH");
  lines.push("");
  if (policy.mustAuth.length === 0) {
    lines.push("(none)");
  } else {
    lines.push("| Route | Reason |");
    lines.push("| --- | --- |");
    for (const entry of policy.mustAuth) {
      lines.push(`| ${entry.route} | ${entry.reason ?? ""} |`);
    }
  }
  lines.push("");
  lines.push("## Detected public routes");
  lines.push("");
  for (const route of publicRoutes.sort()) {
    lines.push(`- ${route}`);
  }
  lines.push("");
  return lines.join("\n");
}

function main() {
  const policyRaw = fs.readFileSync(policyPath, "utf8");
  const policy = JSON.parse(policyRaw) as Policy;

  const files = walk(apiRoot);
  const publicRoutes = files.filter(isPublicRoute).map(toRoute);

  const publicOkSet = new Set(policy.publicOk.map((entry) => entry.route));
  const mustAuthSet = new Set(policy.mustAuth.map((entry) => entry.route));

  const missing: string[] = [];
  for (const route of publicRoutes) {
    if (!publicOkSet.has(route) && !mustAuthSet.has(route)) {
      missing.push(route);
    }
  }

  ensureDocsDir();
  fs.writeFileSync(outputPath, buildMarkdown(policy, publicRoutes), "utf8");

  if (missing.length > 0) {
    console.error("Public endpoints missing policy entries:");
    for (const route of missing) {
      console.error(`- ${route}`);
    }
    process.exit(1);
  }
}

main();
