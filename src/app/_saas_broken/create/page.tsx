import { headers } from "next/headers";
import SaasFactoryInteractiveShell from "@/app/saas/create/SaasFactoryInteractiveShell";
import { createDefaultBlueprint } from "@/app/saas/create/blueprint";
import type { SaasFactoryProvisioningResult } from "@/app/saas/create/types";
import { queryAll } from "@/lib/db";
import { resolveTenantId } from "@/lib/tenants/services";

export const dynamic = "force-dynamic";

type ProvisioningRow = {
  step: string;
  status: string;
  details: string | null;
};

async function loadLatestProvisioning(tenantId: string): Promise<SaasFactoryProvisioningResult | null> {
  const saasRows = await queryAll<{ id: string }>(
    "SELECT id FROM saas WHERE tenant_id = ? ORDER BY created_at DESC LIMIT 1",
    tenantId,
  );
  const saasId = saasRows[0]?.id ?? null;
  if (!saasId) return null;
  const rows = await queryAll<ProvisioningRow>(
    "SELECT step, status, details FROM provisioning WHERE tenant_id = ? AND saas_id = ? ORDER BY created_at DESC",
    tenantId,
    saasId,
  );
  const byStep = new Map<string, ProvisioningRow>();
  for (const row of rows) {
    if (!byStep.has(row.step)) {
      byStep.set(row.step, row);
    }
  }
  const cloudflare = byStep.get("cloudflare");
  const stripe = byStep.get("stripe");
  const ai = byStep.get("ai");

  return {
    saasId,
    cloudflare: cloudflare ? { status: cloudflare.status, message: cloudflare.details } : null,
    stripe: stripe ? { status: stripe.status, message: stripe.details } : null,
    ai: ai ? { status: ai.status } : null,
  };
}

export default async function SaasCreatePage({
  searchParams,
}: {
  searchParams?: Promise<Record<string, string | string[] | undefined>>;
}) {
  const headerList = await headers();
  const resolvedSearchParams = await searchParams;
  const url = new URL("http://internal/saas/create");
  if (resolvedSearchParams) {
    for (const [key, value] of Object.entries(resolvedSearchParams)) {
      if (typeof value === "string") url.searchParams.set(key, value);
      if (Array.isArray(value)) value.forEach((item) => url.searchParams.append(key, item));
    }
  }
  const request = new Request(url, { headers: new Headers(headerList) });
  const tenantId = resolveTenantId(request);
  const initialBlueprintDraft = createDefaultBlueprint(tenantId);
  const initialProvisioningState = await loadLatestProvisioning(tenantId);
  const packId = typeof resolvedSearchParams?.packId === "string" ? resolvedSearchParams.packId : null;

  return (
    <SaasFactoryInteractiveShell
      initialBlueprintDraft={initialBlueprintDraft}
      initialProvisioningState={initialProvisioningState}
      packId={packId}
    />
  );
}
