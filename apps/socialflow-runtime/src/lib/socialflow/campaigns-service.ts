import {
  listRuntimeCampaignsFromDb,
  SocialContextError,
  upsertRuntimeCampaignInDb,
} from "./campaigns-repository";

export { SocialContextError };

export async function listRuntimeCampaigns(params: { tenantId: string; saasId: string }) {
  return listRuntimeCampaignsFromDb(params);
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
  return upsertRuntimeCampaignInDb({
    tenantId: params.tenantId,
    campaign: {
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
    },
  });
}
