import { spawn } from "node:child_process";
import { readdir } from "node:fs/promises";
import path from "node:path";
import process from "node:process";

type ChecklistStatus = "ok" | "pending";
type AlertSeverity = "critical" | "high" | "medium" | "low";

type ProjectRecord = {
  id: string;
  name: string;
  branch_name?: string | null;
  status?: string;
};

type ChecklistResult = {
  status: ChecklistStatus;
  notes?: string[];
  durationMs?: number;
};

const ROOT_DIR = path.resolve(__dirname, "..");
const SOURCE_DIRS = ["src/app", "src/components", "src/lib"].map((dir) => path.join(ROOT_DIR, dir));
const SINGULAR_NAMES = ["agent", "alert", "metric", "document", "user", "project", "session", "checklist", "department"];
const IGNORED_FOLDERS = new Set(["node_modules", ".next", ".git", ".turbo", ".dist", "scripts"]);

const DEFAULT_BASE_URL = process.env.DEVARCHITECT_API_BASE ?? "http://localhost:3000";
const DEFAULT_TENANT = process.env.DEVARCHITECT_TENANT ?? "demo-tenant";
type DevArchitectTaskRecord = {
  id: string;
  status: "todo" | "in_progress" | "done" | "blocked";
  title?: string;
};

async function walkDir(dir: string, collector: string[]) {
  let entries;
  try {
    entries = await readdir(dir, { withFileTypes: true });
  } catch {
    return;
  }
  for (const entry of entries) {
    if (entry.name.startsWith(".")) continue;
    if (entry.isDirectory() && IGNORED_FOLDERS.has(entry.name)) continue;
    const fullPath = path.join(dir, entry.name);
    if (entry.isDirectory()) {
      if (isSuspiciousName(entry.name)) {
        collector.push(path.relative(ROOT_DIR, fullPath));
      }
      await walkDir(fullPath, collector);
    } else {
      const baseName = path.parse(entry.name).name;
      if (isSuspiciousName(baseName)) {
        collector.push(path.relative(ROOT_DIR, fullPath));
      }
    }
  }
}

function isSuspiciousName(name: string) {
  return SINGULAR_NAMES.includes(name.toLowerCase());
}

async function auditNamingRule(): Promise<ChecklistResult> {
  const violations: string[] = [];
  for (const dir of SOURCE_DIRS) {
    await walkDir(dir, violations);
  }
  const limited = violations.slice(0, 15);
  return {
    status: violations.length === 0 ? "ok" : "pending",
    notes: limited,
  };
}

async function runGuardianBuild(): Promise<ChecklistResult> {
  const start = Date.now();
  return new Promise((resolve) => {
    const child = spawn("npm", ["run", "qa"], {
      cwd: ROOT_DIR,
      shell: process.platform === "win32",
      env: process.env,
    });
    const chunks: string[] = [];
    const handleChunk = (chunk: Buffer) => {
      if (chunks.length > 40) return;
      chunks.push(chunk.toString());
    };
    child.stdout.on("data", handleChunk);
    child.stderr.on("data", handleChunk);
    child.on("error", (error) => {
      resolve({
        status: "pending",
        durationMs: Date.now() - start,
        notes: [`Fallo al ejecutar npm run qa: ${error.message}`],
      });
    });
    child.on("close", (code) => {
      const durationMs = Date.now() - start;
      if (code === 0) {
        resolve({ status: "ok", durationMs });
        return;
      }
      const snippet = chunks.join("").split(/\r?\n/).filter(Boolean).slice(0, 8);
      resolve({
        status: "pending",
        durationMs,
        notes: [
          `npm run qa salió con código ${code ?? -1}`,
          ...snippet,
        ],
      });
    });
  });
}

async function fetchJson<T>(url: string, init?: RequestInit): Promise<T> {
  const response = await fetch(url, init);
  if (!response.ok) {
    const body = await response.text();
    throw new Error(`Request failed (${response.status}): ${body}`);
  }
  return response.json() as Promise<T>;
}

async function fetchProjects(baseUrl: string, tenantId: string) {
  const url = new URL("/api/dev-architects/projects", baseUrl);
  url.searchParams.set("tenantId", tenantId);
  const data = await fetchJson<{ items?: ProjectRecord[] }>(url.toString());
  return data.items ?? [];
}

async function auditAgents(baseUrl: string, tenantId: string): Promise<ChecklistResult> {
  const url = new URL("/api/agents", baseUrl);
  url.searchParams.set("tenantId", tenantId);
  try {
    const data = await fetchJson<{ items?: unknown[]; count?: number }>(url.toString(), { headers: { "content-type": "application/json" } });
    const count = typeof data.count === "number" ? data.count : (Array.isArray(data.items) ? data.items.length : 0);
    if (count > 0) {
      return { status: "ok", notes: [`${count} agentes registrados`] };
    }
    return { status: "pending", notes: ["No se encontraron agentes activos"] };
  } catch (error) {
    return { status: "pending", notes: [`Error consultando agentes: ${error instanceof Error ? error.message : String(error)}`] };
  }
}

async function updateChecklist(baseUrl: string, tenantId: string, projectId: string, key: string, status: ChecklistStatus) {
  const url = new URL("/api/dev-architects/checklists", baseUrl);
  url.searchParams.set("tenantId", tenantId);
  await fetchJson(url.toString(), {
    method: "POST",
    headers: { "content-type": "application/json" },
    body: JSON.stringify({ projectId, key, status }),
  });
}

async function createAuditSession(baseUrl: string, tenantId: string, projectId: string, status: "ok" | "warning", summary: object) {
  const url = new URL("/api/dev-architects/sessions", baseUrl);
  url.searchParams.set("tenantId", tenantId);
  await fetchJson(url.toString(), {
    method: "POST",
    headers: { "content-type": "application/json" },
    body: JSON.stringify({
      projectId,
      mode: "Audit",
      title: `Auditoría OLIMPO – ${status === "ok" ? "OK" : "WARNING"}`,
      summary: JSON.stringify(summary),
    }),
  });
}

async function syncAuditAlert(
  baseUrl: string,
  tenantId: string,
  payload: { projectId: string; status: "open" | "resolved"; severity?: AlertSeverity; message?: string; pendingRules?: string[] },
) {
  const url = new URL("/api/dev-architects/alerts", baseUrl);
  url.searchParams.set("tenantId", tenantId);
  await fetchJson(url.toString(), {
    method: "POST",
    headers: { "content-type": "application/json" },
    body: JSON.stringify({
      projectId: payload.projectId,
      status: payload.status,
      severity: payload.severity,
      message: payload.message,
      pendingRules: payload.pendingRules,
    }),
  });
}

function determineAlertSeverity(results: Record<string, ChecklistResult>): AlertSeverity {
  if (results.build?.status === "pending") return "high";
  if (results.naming?.status === "pending" && results.agents?.status === "pending") return "medium";
  if (results.naming?.status === "pending" || results.agents?.status === "pending") return "medium";
  return "low";
}

async function fetchAuditTasks(baseUrl: string, tenantId: string, projectId: string) {
  const url = new URL("/api/dev-architects/tasks", baseUrl);
  url.searchParams.set("tenantId", tenantId);
  url.searchParams.set("projectId", projectId);
  url.searchParams.set("source", "audit");
  const data = await fetchJson<{ items?: DevArchitectTaskRecord[] }>(url.toString());
  return data.items ?? [];
}

async function createAuditTask(baseUrl: string, tenantId: string, projectId: string, payload: { title: string; description?: string }) {
  const url = new URL("/api/dev-architects/tasks", baseUrl);
  url.searchParams.set("tenantId", tenantId);
  await fetchJson(url.toString(), {
    method: "POST",
    headers: { "content-type": "application/json" },
    body: JSON.stringify({
      projectId,
      title: payload.title,
      description: payload.description ?? null,
      source: "audit",
      status: "todo",
      priority: "high",
    }),
  });
}

async function updateAuditTask(
  baseUrl: string,
  tenantId: string,
  payload: { id: string; projectId: string; status?: DevArchitectTaskRecord["status"]; description?: string },
) {
  const url = new URL("/api/dev-architects/tasks", baseUrl);
  url.searchParams.set("tenantId", tenantId);
  await fetchJson(url.toString(), {
    method: "PATCH",
    headers: { "content-type": "application/json" },
    body: JSON.stringify({
      id: payload.id,
      projectId: payload.projectId,
      status: payload.status,
      description: payload.description ?? null,
    }),
  });
}

async function ensureAuditBacklogTask(
  baseUrl: string,
  tenantId: string,
  projectId: string,
  projectName: string,
  pendingRules: string[],
) {
  const tasks = await fetchAuditTasks(baseUrl, tenantId, projectId);
  const existing = tasks[0];
  const description = pendingRules.length > 0
    ? `Reglas pendientes: ${pendingRules.join(", ")}`
    : "Revisa la bitácora DevArchitect para detalles.";
  if (!existing) {
    await createAuditTask(baseUrl, tenantId, projectId, {
      title: `Resolver auditoría OLIMPO – ${projectName}`,
      description,
    });
    return;
  }
  if (existing.status === "done") {
    await updateAuditTask(baseUrl, tenantId, { id: existing.id, projectId, status: "todo", description });
  } else {
    await updateAuditTask(baseUrl, tenantId, { id: existing.id, projectId, description });
  }
}

async function completeAuditBacklogTasks(baseUrl: string, tenantId: string, projectId: string) {
  const tasks = await fetchAuditTasks(baseUrl, tenantId, projectId);
  const targets = tasks.filter((task) => task.status !== "done");
  await Promise.all(
    targets.map((task) =>
      updateAuditTask(baseUrl, tenantId, { id: task.id, projectId, status: "done" }),
    ),
  );
}

function parseProjectArg(): string | null {
  const args = process.argv.slice(2);
  for (let i = 0; i < args.length; i += 1) {
    const token = args[i];
    if (token.startsWith("--project=")) {
      return token.split("=")[1] ?? null;
    }
    if (token === "--project" && args[i + 1]) {
      return args[i + 1];
    }
  }
  return null;
}

async function main() {
  const projectFilter = parseProjectArg();
  const baseUrl = DEFAULT_BASE_URL;
  const tenantId = DEFAULT_TENANT;

  console.log("🔍 Iniciando auditoría OLIMPO estática...");
  const projects = await fetchProjects(baseUrl, tenantId);
  if (projects.length === 0) {
    console.error("No se encontraron proyectos DevArchitect. Aborta.");
    process.exit(1);
  }

  const filteredProjects = projectFilter
    ? projects.filter((project) => project.id === projectFilter)
    : projects;

  if (filteredProjects.length === 0) {
    console.error(`Proyecto con id '${projectFilter}' no encontrado.`);
    process.exit(1);
  }

  const [namingResult, guardianResult, agentsResult] = await Promise.all([
    auditNamingRule(),
    runGuardianBuild(),
    auditAgents(baseUrl, tenantId),
  ]);

  for (const project of filteredProjects) {
    const perProject = {
      naming: namingResult,
      build: guardianResult,
      agents: agentsResult,
    };
    for (const [key, result] of Object.entries(perProject)) {
      try {
        await updateChecklist(baseUrl, tenantId, project.id, key, result.status);
      } catch (error) {
        console.warn(`⚠️  Error actualizando checklist '${key}' para ${project.name}:`, error);
      }
    }
    const overallStatus = Object.values(perProject).some((item) => item.status === "pending") ? "warning" : "ok";
    const pendingRules = Object.entries(perProject)
      .filter(([, result]) => result.status === "pending")
      .map(([ruleKey]) => ruleKey);
    const summary = {
      type: "audit",
      status: overallStatus,
      executedAt: new Date().toISOString(),
      results: perProject,
      projectId: project.id,
    };
    if (overallStatus === "warning") {
      try {
        await syncAuditAlert(baseUrl, tenantId, {
          projectId: project.id,
          status: "open",
          severity: determineAlertSeverity(perProject),
          message: `Auditoría OLIMPO (${project.name}) detectó pendientes en ${pendingRules.join(", ")}`,
          pendingRules,
        });
      } catch (error) {
        console.warn(`⚠️  No se pudo sincronizar alerta para ${project.name}:`, error);
      }
    } else {
      try {
        await syncAuditAlert(baseUrl, tenantId, {
          projectId: project.id,
          status: "resolved",
        });
      } catch (error) {
        console.warn(`⚠️  No se pudo resolver la alerta para ${project.name}:`, error);
      }
    }
    if (overallStatus === "warning") {
      try {
        await ensureAuditBacklogTask(baseUrl, tenantId, project.id, project.name, pendingRules);
      } catch (error) {
        console.warn(`⚠️  No se pudo actualizar el backlog para ${project.name}:`, error);
      }
    } else {
      try {
        await completeAuditBacklogTasks(baseUrl, tenantId, project.id);
      } catch (error) {
        console.warn(`⚠️  No se pudieron cerrar las tareas de auditoría para ${project.name}:`, error);
      }
    }
    try {
      await createAuditSession(baseUrl, tenantId, project.id, overallStatus, summary);
      console.log(`✅ Auditoría registrada para ${project.name} (${overallStatus.toUpperCase()})`);
    } catch (error) {
      console.warn(`⚠️  No se pudo registrar la sesión para ${project.name}:`, error);
    }
  }
}

main().catch((error) => {
  console.error("❌ Auditoría OLIMPO abortada por error:", error);
  process.exit(1);
});
