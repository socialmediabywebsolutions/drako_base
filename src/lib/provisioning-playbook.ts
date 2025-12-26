import { queryAll, run } from "@/lib/db";

export type ProvisioningPlaybookStep = {
  id: string;
  saas_id: string;
  tenant_id?: string;
  step: string;
  status: string;
  details: string | null;
  created_at: string;
};

export type ProvisioningPlaybookResult = {
  ok: true;
  saasId: string;
  saasSlug: string;
  steps: ProvisioningPlaybookStep[];
  newStatus: string;
};

export type ProvisioningPlaybookError = {
  ok: false;
  error: string;
};

type ExecuteArgs = {
  saasSlug: string;
  tenantId: string;
};

type SaasRow = {
  id: string;
  slug: string;
  status: string;
  tenant_id: string;
};

export async function executeProvisioningPlaybookForSaaS(
  args: ExecuteArgs,
): Promise<ProvisioningPlaybookResult | ProvisioningPlaybookError> {
  const rawSlug = args.saasSlug?.trim();
  if (!rawSlug) {
    return { ok: false, error: "saasSlug requerido" };
  }

  const slug = rawSlug.toLowerCase();

  const saasRows = await queryAll<SaasRow>(
    "SELECT id, slug, status, tenant_id FROM saas WHERE slug = ? AND tenant_id = ? LIMIT 1",
    slug,
    args.tenantId,
  );
  const saas = saasRows[0];
  if (!saas) {
    return { ok: false, error: `No se encontró un SaaS con slug '${slug}'` };
  }

  const baseDefinitions: { step: string; details: string }[] = [
    {
      step: "domain",
      details: "DNS + SSL en Cloudflare registrados desde el Chat Orquestador.",
    },
    {
      step: "pages_project",
      details: "Conexión al proyecto de Cloudflare Pages registrada desde el Chat Orquestador.",
    },
    {
      step: "connect",
      details: "Verificación de certificados y conexiones finales registrada desde el Chat Orquestador.",
    },
  ];

  const existing = await queryAll<ProvisioningPlaybookStep>(
    "SELECT id, saas_id, tenant_id, step, status, details, created_at FROM provisioning WHERE saas_id = ? AND tenant_id = ? ORDER BY created_at DESC",
    saas.id,
    args.tenantId,
  );

  const createdOrUpdated: ProvisioningPlaybookStep[] = [];

  for (const def of baseDefinitions) {
    const current = existing.find((row) => row.step === def.step);
    if (!current) {
      const id = globalThis.crypto?.randomUUID?.() ?? `prov_${Date.now()}_${def.step}`;
      const ok = await run(
        "INSERT INTO provisioning (id, saas_id, tenant_id, step, status, details) VALUES (?, ?, ?, ?, 'completed', ?)",
        id,
        saas.id,
        args.tenantId,
        def.step,
        def.details,
      );
      if (ok) {
        createdOrUpdated.push({
          id,
          saas_id: saas.id,
          tenant_id: args.tenantId,
          step: def.step,
          status: "completed",
          details: def.details,
          created_at: new Date().toISOString(),
        });
      }
    } else {
      const mergedDetails = current.details ?? def.details;
      const ok = await run(
        "UPDATE provisioning SET status = 'completed', details = COALESCE(details, ?), tenant_id = ? WHERE id = ?",
        def.details,
        args.tenantId,
        current.id,
      );
      if (ok) {
        createdOrUpdated.push({
          ...current,
          tenant_id: args.tenantId,
          status: "completed",
          details: mergedDetails,
        });
      } else {
        createdOrUpdated.push(current);
      }
    }
  }

  let newStatus = saas.status;
  if (newStatus !== "active") {
    const updated = await run(
      "UPDATE saas SET status = 'active' WHERE id = ? AND tenant_id = ?",
      saas.id,
      args.tenantId,
    );
    if (updated) {
      newStatus = "active";
    }
  }

  const finalSteps = await queryAll<ProvisioningPlaybookStep>(
    "SELECT id, saas_id, tenant_id, step, status, details, created_at FROM provisioning WHERE saas_id = ? AND tenant_id = ? ORDER BY created_at DESC",
    saas.id,
    args.tenantId,
  );

  return {
    ok: true,
    saasId: saas.id,
    saasSlug: saas.slug,
    steps: finalSteps,
    newStatus,
  };
}
