import { describe, expect, it } from "vitest";
import { readFileSync } from "node:fs";

// Un pull_request construye y valida, pero nunca toca producción: ningún paso que migre
// D1, cree colas o despliegue un Worker puede ejecutarse sin la guarda de evento.

const PR_GUARD = "${{ github.event_name != 'pull_request' }}";
// Comandos que modifican producción. El dry-run de wrangler no sube nada y queda fuera.
const PRODUCTION_COMMAND = /wrangler d1 execute|wrangler queues create|wrangler deploy(?![^\n]*--dry-run)/;

type Step = { name?: string; run?: string; if?: string };
type Job = { if?: string; steps: Step[] };

// Lector mínimo del workflow (sin dependencias): jobs a 2 espacios, pasos "      - name:".
function readWorkflow(source: string): { on: string[]; jobs: Record<string, Job> } {
  const lines = source.split("\n");
  const on: string[] = [];
  const jobs: Record<string, Job> = {};
  let section: "on" | "jobs" | null = null;
  let job: Job | null = null;
  let step: Step | null = null;
  for (const line of lines) {
    if (/^on:/.test(line)) section = "on";
    else if (/^jobs:/.test(line)) section = "jobs";
    else if (/^\S/.test(line)) section = null;
    if (section === "on") {
      const event = line.match(/^  ([a-z_]+):/);
      if (event) on.push(event[1]);
      continue;
    }
    if (section !== "jobs") continue;
    const jobMatch = line.match(/^  ([a-z_]+):\s*$/);
    if (jobMatch) {
      job = { steps: [] };
      jobs[jobMatch[1]] = job;
      step = null;
      continue;
    }
    if (!job) continue;
    const jobIf = line.match(/^    if: (.*)$/);
    if (jobIf) job.if = jobIf[1].trim();
    const stepName = line.match(/^      - name: (.*)$/);
    if (stepName) {
      step = { name: stepName[1].trim(), run: "" };
      job.steps.push(step);
      continue;
    }
    if (!step) continue;
    const stepIf = line.match(/^        if: (.*)$/);
    if (stepIf) step.if = stepIf[1].trim();
    if (/^        (run: |  )/.test(line) || /^          /.test(line)) step.run += `${line}\n`;
  }
  return { on, jobs };
}

const workflow = readWorkflow(readFileSync(".github/workflows/drako-factory-deploy.yml", "utf8"));

describe("drako-factory-deploy: pull requests never touch production", () => {
  it("the workflow still runs on pull_request (build + validation)", () => {
    expect(workflow.on).toContain("pull_request");
  });

  it("every step that migrates, creates queues or deploys is guarded (or its job is)", () => {
    const unguarded: string[] = [];
    for (const [jobName, job] of Object.entries(workflow.jobs)) {
      if (job.if?.includes(PR_GUARD)) continue;
      for (const step of job.steps) {
        if (step.run && PRODUCTION_COMMAND.test(step.run) && step.if !== PR_GUARD) {
          unguarded.push(`${jobName} › ${step.name ?? "(unnamed step)"}`);
        }
      }
    }
    expect(unguarded).toEqual([]);
  });

  it("post-deploy smoke jobs only run when something was deployed", () => {
    expect(workflow.jobs.smoke.if).toBe(PR_GUARD);
    expect(workflow.jobs.socialcors_smoke.if).toBe(PR_GUARD);
  });

  it("covers the deploy steps of both lanes", () => {
    const deploySteps = Object.values(workflow.jobs)
      .flatMap((job) => job.steps)
      .filter((step) => /^Deploy /.test(step.name ?? ""));
    expect(deploySteps.map((step) => step.name)).toEqual([
      "Deploy in strict order (scheduler -> drakos -> mentorias -> bases)",
      "Deploy SocialCors (AI Worker first, then web)",
    ]);
    expect(deploySteps.every((step) => step.if === PR_GUARD)).toBe(true);
  });
});
