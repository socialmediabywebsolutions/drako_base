import { queryAll, queryOne, run } from "../db/runtime-db";
import type { RuntimeCampaignUpsertInput, RuntimeSocialCampaign } from "./contracts";
import { mapSocialCampaignRow, nowIso, resolveRuntimeSocialContext, SocialContextError } from "./runtime-repository-core";
import { normalizeRuntimeCampaignInput } from "./validators";

type SocialCampaignRow = {
  id: string;
  tenant_id: string;
  saas_id: string;
  name: string;
  objective: string;
  status: string;
  target_segment: string;
  start_date: string | null;
  end_date: string | null;
  budget_estimate: number | null;
  notes: string | null;
  created_at: string;
  updated_at: string;
};

function generateCampaignId() {
  try {
    return `sf_campaign_${globalThis.crypto?.randomUUID?.() ?? Math.random().toString(16).slice(2)}`;
  } catch {
    return `sf_campaign_${Date.now()}_${Math.random().toString(16).slice(2)}`;
  }
}

export { SocialContextError };

export async function listRuntimeCampaignsFromDb(params: { tenantId: string; saasId: string }): Promise<RuntimeSocialCampaign[]> {
  const context = await resolveRuntimeSocialContext(params);
  const rows = await queryAll<SocialCampaignRow>(
    context.socialDb,
    `SELECT id, tenant_id, saas_id, name, objective, status, target_segment, start_date, end_date, budget_estimate, notes, created_at, updated_at
     FROM saas_social_campaigns
     WHERE tenant_id = ? AND saas_id = ?
     ORDER BY datetime(created_at) DESC`,
    context.tenantId,
    context.saasId,
  );
  return rows.map(mapSocialCampaignRow);
}

export async function getRuntimeCampaignByIdFromDb(params: { tenantId: string; saasId: string; campaignId: string }) {
  const context = await resolveRuntimeSocialContext(params);
  const row = await queryOne<SocialCampaignRow>(
    context.socialDb,
    `SELECT id, tenant_id, saas_id, name, objective, status, target_segment, start_date, end_date, budget_estimate, notes, created_at, updated_at
     FROM saas_social_campaigns
     WHERE id = ? AND tenant_id = ? AND saas_id = ?
     LIMIT 1`,
    params.campaignId,
    context.tenantId,
    context.saasId,
  );
  return row ? mapSocialCampaignRow(row) : null;
}

export async function upsertRuntimeCampaignInDb(params: { tenantId: string; campaign: RuntimeCampaignUpsertInput }) {
  const input = normalizeRuntimeCampaignInput(params.campaign);
  const context = await resolveRuntimeSocialContext({
    tenantId: params.tenantId,
    saasId: input.saasId,
  });

  if (!input.name) {
    throw new SocialContextError("Campaign name is required.");
  }

  const id = input.id ?? generateCampaignId();
  const now = nowIso();

  await run(
    context.socialDb,
    `INSERT INTO saas_social_campaigns (id, tenant_id, saas_id, name, objective, status, target_segment, start_date, end_date, budget_estimate, notes, created_at, updated_at)
     VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
     ON CONFLICT(id) DO UPDATE SET
       name = excluded.name,
       objective = excluded.objective,
       status = excluded.status,
       target_segment = excluded.target_segment,
       start_date = excluded.start_date,
       end_date = excluded.end_date,
       budget_estimate = excluded.budget_estimate,
       notes = excluded.notes,
       updated_at = excluded.updated_at
     WHERE saas_social_campaigns.tenant_id = excluded.tenant_id
       AND saas_social_campaigns.saas_id = excluded.saas_id`,
    id,
    context.tenantId,
    context.saasId,
    input.name,
    input.objective,
    input.status,
    input.targetSegment,
    input.startDate,
    input.endDate,
    input.budgetEstimate,
    input.notes,
    now,
    now,
  );

  const stored = await getRuntimeCampaignByIdFromDb({
    tenantId: context.tenantId,
    saasId: context.saasId,
    campaignId: id,
  });

  if (!stored) {
    throw new SocialContextError("Unable to persist campaign inside the SocialFlow runtime.");
  }

  return stored;
}
