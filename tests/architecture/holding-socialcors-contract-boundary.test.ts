import { describe, expect, it } from "vitest";
import { existsSync, readdirSync, readFileSync, statSync } from "node:fs";
import path from "node:path";

/**
 * P6: guardarraíl inverso al de P1. El holding (DracoBase) solo puede hablar con SocialCors
 * por el contrato interno (/api/internal/socialflow/*, lib/capabilities/internal-api-*):
 * nada de imports de módulos de SocialCors ni de sus bindings (SOCIAL_DB, cola IA, R2).
 *
 * HOLDING_DEBT es la deuda que queda (fuera del panel del operator). Solo puede encoger.
 */

const repoRoot = process.cwd();

const SOCIALCORS_DOMAIN = [
  "src/lib/socialflow/",
  "src/lib/social-core/",
  "src/components/socialflow/",
  "apps/socialcors/",
  "workers/socialflow-ai-worker/",
];
const HOLDING_ROOTS = ["src", "workers", "packages"];
const NEUTRAL_FILES = new Set(["src/lib/cf.ts"]);

const SOCIALCORS_IMPORT = /from\s+["']@\/(?:lib\/(?:socialflow|social-core)|components\/socialflow)\//;
// Uso real de bindings (no menciones en comentarios): env()?.SOCIAL_DB, bindings.SOCIAL_DB…
const SOCIALCORS_BINDING = /\.\s*(?:SOCIAL_DB|SOCIALFLOW_AI_QUEUE|SOCIAL_MEDIA_BUCKET|SOCIALFLOW_AUTHS_DB)\b/;

// Deuda conocida: [fichero, motivo, fase en la que se retira].
const HOLDING_DEBT: Record<string, string> = {
  "src/lib/capabilities/social-publishing/publisher.ts": "Mentoría publica vía social-core (import)",
  "src/lib/saas/repository.ts": "enlaces sociales de la ficha SaaS (import)",
  "src/lib/export/wipeout-package.ts": "export del tenant (import) — P9",
  "src/lib/integration-core/providers/linkedin.ts": "proveedor LinkedIn de integration-core (import) — P5/P6",
  "src/lib/security/cron-lock.ts": "crons del holding usan SOCIAL_DB.cron_locks (binding) — P10",
  "src/lib/ai/usage.ts": "contador de uso IA compartido (binding) — P5",
  "src/lib/drako/JournalAgent.ts": "Journal escribe en el bucket de SocialCors (binding) — P10",
  "src/lib/auths/repositories.ts": "rama socialflow de la auth multi-producto, la usa sso-init (binding SOCIALFLOW_AUTHS_DB) — P9/P13",
};

function listCodeFiles(dir: string): string[] {
  const absolute = path.join(repoRoot, dir);
  if (!existsSync(absolute)) return [];
  return readdirSync(absolute).flatMap((entry) => {
    if (entry === "node_modules" || entry.startsWith(".")) return [];
    const relative = `${dir}/${entry}`;
    if (statSync(path.join(repoRoot, relative)).isDirectory()) return listCodeFiles(relative);
    return /\.(?:ts|tsx)$/.test(entry) && !/\.(?:test|spec)\./.test(entry) ? [relative] : [];
  });
}

function stripComments(source: string): string {
  return source.replace(/\/\*[\s\S]*?\*\//g, "").replace(/(^|[^:])\/\/.*$/gm, "$1");
}

function findCoupledHoldingFiles(): string[] {
  return HOLDING_ROOTS.flatMap(listCodeFiles)
    .filter((file) => !SOCIALCORS_DOMAIN.some((prefix) => file.startsWith(prefix)) && !NEUTRAL_FILES.has(file))
    .filter((file) => {
      const source = stripComments(readFileSync(path.join(repoRoot, file), "utf8"));
      return SOCIALCORS_IMPORT.test(source) || SOCIALCORS_BINDING.test(source);
    })
    .sort();
}

describe("Holding → SocialCors: solo por el contrato interno (P6)", () => {
  const coupled = findCoupledHoldingFiles();

  it("el panel del operator y el canal WhatsApp no tocan SocialCors directamente", () => {
    const operatorSurface = [
      "src/app/api/operator/socialflow/route.ts",
      "src/app/api/operator/socialflow/churn-risk/route.ts",
      "src/lib/campamento-base/socialflow-control-plane-service.ts",
      "src/lib/conversation-router/handlers/socialflow-whatsapp-handler.ts",
      "src/lib/owner/types.ts",
      "src/components/campobase/CampoBaseSocialAutomationControl.tsx",
    ];
    expect(coupled.filter((file) => operatorSurface.includes(file))).toEqual([]);
  });

  it("no aparecen acoplamientos nuevos fuera de la deuda registrada", () => {
    expect(coupled.filter((file) => !(file in HOLDING_DEBT))).toEqual([]);
  });

  it("la deuda solo encoge: retira de HOLDING_DEBT lo que ya está desacoplado", () => {
    expect(Object.keys(HOLDING_DEBT).filter((file) => !coupled.includes(file))).toEqual([]);
  });
});
