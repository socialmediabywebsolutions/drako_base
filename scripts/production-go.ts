import { promises as fs } from "node:fs";
import path from "node:path";

type CheckResult = {
  name: string;
  ok: boolean;
  detail: string;
};

async function detectRepoRoot(): Promise<string | null> {
  const visited = new Set<string>();
  let current = path.resolve(__dirname);

  for (let depth = 0; depth < 10; depth += 1) {
    if (visited.has(current)) break;
    visited.add(current);

    const candidate = current;
    const pkg = path.join(candidate, "package.json");
    const srcDir = path.join(candidate, "src");
    const migrationsDir = path.join(candidate, "migrations");

    try {
      const [pkgStat, srcStat, migStat] = await Promise.all([
        fs.stat(pkg),
        fs.stat(srcDir),
        fs.stat(migrationsDir),
      ]);
      if (pkgStat.isFile() && srcStat.isDirectory() && migStat.isDirectory()) {
        return candidate;
      }
    } catch {
      // ignore and continue upwards
    }

    const parent = path.dirname(candidate);
    if (parent === candidate) break;
    current = parent;
  }

  return null;
}

let repoRootCache: string | null = null;

async function getRepoRoot(): Promise<string> {
  if (repoRootCache) return repoRootCache;
  const detected = await detectRepoRoot();
  if (!detected) {
    const hint = "Run from repo root (e.g. /home/cris/drako_base-repo)";
    const reason = "REPO_ROOT_NOT_FOUND";
    const message = [
      "⛔ production-go: unable to locate repository root", 
      `reason: ${reason}`,
      `hint: ${hint}`,
    ].join("\n");
    console.error(message);
    process.exitCode = 1;
    throw new Error(reason);
  }
  repoRootCache = detected;
  return detected;
}

async function pathExists(relativePath: string): Promise<boolean> {
  const root = await getRepoRoot();
  try {
    await fs.access(path.join(root, relativePath));
    return true;
  } catch {
    return false;
  }
}

async function readFile(relativePath: string): Promise<string | null> {
  const root = await getRepoRoot();
  try {
    return await fs.readFile(path.join(root, relativePath), "utf8");
  } catch {
    return null;
  }
}

async function main() {
  const root = await getRepoRoot();
  const results: CheckResult[] = [];
  let hasFailures = false;

  const requiredWorkerFiles = [
    "workers/autopilot-worker/src/index.ts",
    "workers/autopilot-worker/src/hostnames.ts",
    "workers/autopilot-worker/wrangler.toml",
  ];

  for (const file of requiredWorkerFiles) {
    const exists = await pathExists(file);
    results.push({
      name: `worker:file:${file}`,
      ok: exists,
      detail: exists ? "present" : "missing",
    });
    hasFailures ||= !exists;
  }

  const runbookExists = await pathExists("docs/runbooks/autopilot-worker.md");
  results.push({
    name: "documentation:runbook",
    ok: runbookExists,
    detail: runbookExists ? "docs/runbooks/autopilot-worker.md" : "missing runbook",
  });
  hasFailures ||= !runbookExists;

  const devVarsContent = await readFile("workers/autopilot-worker/.dev.vars.example");
  if (devVarsContent) {
    const requiredVars = ["DRACO_DB", "AUTOPILOT_QUEUE", "AUTOPILOT_DLQ", "APP_URL"];
    for (const variable of requiredVars) {
      const present = devVarsContent.includes(variable);
      results.push({
        name: `vars:${variable}`,
        ok: present,
        detail: present ? "declared" : "missing",
      });
      hasFailures ||= !present;
    }
  } else {
    results.push({
      name: "vars:file",
      ok: false,
      detail: "workers/autopilot-worker/.dev.vars.example missing",
    });
    hasFailures = true;
  }

  const middlewareContent = await readFile("src/middleware.ts");
  const resolverContent = await readFile("src/lib/empire/host-resolver.ts");

  const middlewareChecks = [
    { name: "middleware:event.blocked", needle: "routing.resolve.domain.blocked" },
    { name: "middleware:event.active", needle: "routing.resolve.domain.active" },
    { name: "middleware:reason.pending", needle: "DOMAIN_PENDING_ACTIVATION" },
  ];

  if (middlewareContent) {
    for (const check of middlewareChecks) {
      const present = middlewareContent.includes(check.needle);
      results.push({ name: check.name, ok: present, detail: present ? "present" : `missing ${check.needle}` });
      hasFailures ||= !present;
    }
  } else {
    results.push({ name: "middleware:file", ok: false, detail: "middleware missing" });
    hasFailures = true;
  }

  const statusUtilsContent = await readFile("src/lib/empire/host-status-utils.ts");
  const resolverNeedles = [
    { name: "resolver:pending_activation", needle: "DOMAIN_PENDING_ACTIVATION" },
    { name: "resolver:not_active", needle: "DOMAIN_NOT_ACTIVE" },
  ];

  if (!resolverContent) {
    results.push({ name: "resolver:file", ok: false, detail: "host resolver missing" });
    hasFailures = true;
  }

  for (const check of resolverNeedles) {
    const present = Boolean(
      (resolverContent && resolverContent.includes(check.needle)) ||
      (statusUtilsContent && statusUtilsContent.includes(check.needle)),
    );
    results.push({ name: check.name, ok: present, detail: present ? "present" : `missing ${check.needle}` });
    hasFailures ||= !present;
  }

  const prodUrl = process.env.PROD_URL?.trim();
  if (prodUrl) {
    try {
      const url = new URL(prodUrl.endsWith("/") ? prodUrl : `${prodUrl}/`);
      url.pathname = "/api/health";
      const response = await fetch(url.toString(), {
        headers: {
          "user-agent": "production-go/1.0",
        },
      });
      const ok = response.ok;
      let detail = `status ${response.status}`;
      if (ok) {
        try {
          const body = (await response.json()) as unknown;
          if (typeof body === "object" && body && "resolution" in body) {
            const resolution = (body as { resolution?: { status?: string } }).resolution;
            detail += ` · resolution=${resolution?.status ?? "unknown"}`;
          } else {
            detail += " · resolution unknown";
          }
        } catch {
          detail += " · non-JSON response";
        }
      }
      results.push({ name: "remote:health", ok, detail });
      hasFailures ||= !ok;
    } catch (error) {
      results.push({
        name: "remote:health",
        ok: false,
        detail: `request failed: ${error instanceof Error ? error.message : String(error)}`,
      });
      hasFailures = true;
    }
  } else {
    results.push({ name: "remote:health", ok: true, detail: "PROD_URL not set – skipped" });
  }

  const lines: string[] = [];
  lines.push(`Production Gates – Domains & Hostnames (root: ${root})`);
  for (const result of results) {
    lines.push(`${result.ok ? "✅" : "⛔"} ${result.name}: ${result.detail}`);
  }
  const output = lines.join("\n");
  console.log(output);

  if (hasFailures) {
    process.exitCode = 1;
  }
}

main().catch((error) => {
  console.error("⛔ production-go failed:", error);
  process.exitCode = 1;
});
