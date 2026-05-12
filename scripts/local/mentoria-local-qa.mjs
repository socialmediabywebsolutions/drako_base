import { spawn } from "node:child_process";
import { execFileSync } from "node:child_process";
import { existsSync } from "node:fs";
import process from "node:process";
import { setTimeout as sleep } from "node:timers/promises";

const alignWorker = process.argv.includes("--align-worker");
const bootstrapArgs = ["scripts/local/mentoria-local-bootstrap.mjs"];
if (alignWorker) bootstrapArgs.push("--align-worker");

function run(command, args, options = {}) {
  execFileSync(command, args, {
    stdio: "inherit",
    cwd: options.cwd ?? process.cwd(),
    env: process.env,
  });
}

function ensureDedicatedArtifactWrapper() {
  const dedicatedWorker = ".open-next/mentorias/worker.js";
  const dedicatedAssets = ".open-next/mentorias/assets";
  const globalWorker = ".open-next/worker.js";
  const globalAssets = ".open-next/assets";

  if (existsSync(dedicatedWorker) && existsSync(dedicatedAssets)) return;

  if (existsSync(globalWorker) && existsSync(globalAssets)) {
    console.log("[mentoria-local-qa] generating Mentoria dedicated wrapper artifact from current global OpenNext build");
    run("pnpm", ["build:artifacts:skeleton"]);
  }

  if (!existsSync(dedicatedWorker) || !existsSync(dedicatedAssets)) {
    throw new Error(
      "MENTORIA_DEDICATED_ARTIFACT_MISSING: expected .open-next/mentorias/worker.js and assets. Run pnpm build or pnpm build:factory before qa:align-worker.",
    );
  }
}

run("node", bootstrapArgs);
ensureDedicatedArtifactWrapper();

const baseUrl = (process.env.BASE_URL ?? "http://127.0.0.1:8787").trim().replace(/\/$/, "");
const base = new URL(baseUrl);
const port = base.port || (base.protocol === "https:" ? "443" : "80");
const host = process.env.MENTORIA_LOCAL_HOST ?? "127.0.0.1";

const server = spawn("pnpm", [
  "exec",
  "wrangler",
  "dev",
  "--config",
  "workers/mentorias/wrangler.workers.toml",
  "--port",
  port,
  "--host",
  host,
], {
  cwd: process.cwd(),
  env: process.env,
  stdio: "inherit",
});

function cleanup(code = 0) {
  if (!server.killed) server.kill("SIGTERM");
  process.exit(code);
}

process.on("SIGINT", () => cleanup(130));
process.on("SIGTERM", () => cleanup(143));

const readyUrl = `${baseUrl}/site/mentoria`;
const READY_TIMEOUT_MS = Number(process.env.MENTORIA_READY_TIMEOUT_MS ?? 180000);
const READY_INTERVAL_MS = 1000;

let serverExited = false;
let serverExitCode = null;
server.on("exit", (code) => {
  serverExited = true;
  serverExitCode = code;
});

async function waitForReady() {
  const start = Date.now();
  let attempt = 0;
  while (Date.now() - start < READY_TIMEOUT_MS) {
    attempt++;
    if (serverExited) {
      throw new Error(`WRANGLER_EXITED_EARLY code=${serverExitCode}`);
    }
    try {
      const controller = new AbortController();
      const timer = setTimeout(() => controller.abort(), 5000);
      const res = await fetch(readyUrl, { signal: controller.signal });
      clearTimeout(timer);
      if (res.ok) {
        return;
      }
    } catch (_) {
      // ignore and retry
    }
    if (attempt % 5 === 1) {
      console.log(`Waiting for runtime at ${readyUrl} (attempt ${attempt})...`);
    }
    await sleep(READY_INTERVAL_MS);
  }
  throw new Error(`RUNTIME_NOT_READY timeout_ms=${READY_TIMEOUT_MS}`);
}

try {
  await waitForReady();
  run("node", ["scripts/local/mentoria-local-smoke.mjs"], {
    cwd: process.cwd(),
    env: { ...process.env, BASE_URL: baseUrl },
  });
  cleanup(0);
} catch (error) {
  console.error(error instanceof Error ? error.message : String(error));
  cleanup(1);
}
