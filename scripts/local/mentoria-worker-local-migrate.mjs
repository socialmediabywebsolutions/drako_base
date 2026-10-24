import { execFileSync } from "node:child_process";
import { fileURLToPath } from "node:url";
import path from "node:path";
import process from "node:process";

const scriptDir = path.dirname(fileURLToPath(import.meta.url));
const repoRoot = path.resolve(scriptDir, "..", "..");

const workerConfig = "workers/mentorias/wrangler.workers.toml";
const productBinding = "MENTORIA_DB";
const authBinding = "MENTORIAS_AUTHS_DB";

const productSqlFiles = [
  "migrations/0012_multitenant_core.sql",
  "migrations/0153_mentoria_family_foundation.sql",
  "migrations/0161_mentoria_trial_system.sql",
  "migrations/0176_mentoria_academic_records.sql",
  "migrations/0177_mentoria_academic_documents.sql",
  "migrations/0178_mentoria_academic_extractions.sql",
  "migrations/0179_mentoria_academic_analyses.sql",
  "migrations/0180_mentoria_subject_performance_snapshots.sql",
  "scripts/local/drako_db_local_minimum_schema.sql",
  "workers/mentorias/migrations/0001_local_mentoria_schema_bootstrap.sql",
  "workers/mentorias/migrations/0002_local_runtime_metrics.sql",
  "workers/mentorias/migrations/0003_local_resilience_feedback.sql",
  "workers/mentorias/migrations/0005_local_student_learning_memory.sql",
];

const authSqlFiles = [
  "migrations/0136_auths_isolations.sql",
];

function run(command, args) {
  execFileSync(command, args, {
    cwd: repoRoot,
    env: process.env,
    stdio: "inherit",
  });
}

function applyFiles(binding, files) {
  for (const file of files) {
    run("pnpm", [
      "wrangler",
      "d1",
      "execute",
      binding,
      "--local",
      "--config",
      workerConfig,
      "--file",
      file,
    ]);
  }
}

const target = (process.argv[2] ?? "all").trim().toLowerCase();

if (target !== "all" && target !== "product" && target !== "auth") {
  throw new Error(`Unsupported mentoria local migration target: ${target}`);
}

if (target === "all" || target === "product") {
  applyFiles(productBinding, productSqlFiles);
}

if (target === "all" || target === "auth") {
  applyFiles(authBinding, authSqlFiles);
}

console.log(
  `MENTORIA_LOCAL_MIGRATIONS_OK target=${target} product_binding=${productBinding} auth_binding=${authBinding}`,
);
