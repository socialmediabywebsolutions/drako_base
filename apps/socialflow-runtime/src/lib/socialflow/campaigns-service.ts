import {
  listSaasSocialCampaigns,
  resolveSocialContext,
  SocialContextError,
  upsertSaasSocialCampaign,
} from "@/lib/socialflow/repository";

export { SocialContextError };

export async function listRuntimeCampaigns(params: { tenantId: string; saasId: string }) {
  const context = await resolveSocialContext({
    tenantId: params.tenantId,
    saasId: params.saasId,
  });

  return listSaasSocialCampaigns(context);
}

export async function saveRuntimeCampaign(params: {
  tenantId: string;
  saasId: string;
  campaign: {
    id?: string;
    name: string;
    objective: string;
    status: "ACTIVE" | "PAUSED";
    targetSegment: string;
    startDate: string | null;
    endDate: string | null;
    budgetEstimate: number | null;
    notes: string | null;
  };
}) {
  const context = await resolveSocialContext({
    tenantId: params.tenantId,
    saasId: params.saasId,
  });

  return upsertSaasSocialCampaign(context, {
    id: params.campaign.id,
    saasId: params.saasId,
    name: params.campaign.name,
    objective: params.campaign.objective,
    status: params.campaign.status,
    targetSegment: params.campaign.targetSegment,
    startDate: params.campaign.startDate,
    endDate: params.campaign.endDate,
    budgetEstimate: params.campaign.budgetEstimate,
    notes: params.campaign.notes,
  });
}
