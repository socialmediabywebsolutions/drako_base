import { run } from "@/lib/db";

export type ProvisioningMode = "dry_run" | "live";
export type ProvisioningStatus = "PENDING" | "RUNNING" | "DONE" | "FAILED";

function generateId(saasId: string) {
  return `prov_${saasId}`;
}

export async function upsertProvisioningState(params: {
  tenantId: string;
  saasId: string;
  mode: ProvisioningMode;
  status: ProvisioningStatus;
  plan: Record<string, unknown>;
  correlationId: string;
  lastError?: string | null;
  now?: Date;
}): Promise<void> {
  const now = params.now ?? new Date();
  const timestamp = now.toISOString();
  await run(
    `INSERT INTO campamento_provisioning (
      id,
      tenant_id,
      saas_id,
      mode,
      status,
      plan,
      last_error,
      correlation_id,
      created_at,
      updated_at
    ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
    ON CONFLICT(tenant_id, saas_id) DO UPDATE SET
      mode = excluded.mode,
      status = excluded.status,
      plan = excluded.plan,
      last_error = excluded.last_error,
      correlation_id = excluded.correlation_id,
      updated_at = excluded.updated_at`,
    generateId(params.saasId),
    params.tenantId,
    params.saasId,
    params.mode,
    params.status,
    JSON.stringify(params.plan),
    params.lastError ?? null,
    params.correlationId,
    timestamp,
    timestamp,
  );
}
