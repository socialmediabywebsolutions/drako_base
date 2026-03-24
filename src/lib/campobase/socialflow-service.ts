import { runSocialFlowEngine } from "@/lib/social/ai/socialflow-engine";
import {
  getCampoBaseSocialAutomationRegistryItem,
  listCampoBaseSocialAutomationRegistryItems,
  listEnabledCampoBaseSocialAutomationRegistryItems,
  setCampoBaseSocialAutomationEnabled,
} from "./social-automation-registry";
import {
  recordCampoBaseSocialAutomationRun,
} from "./social-automation-history";

export type CampoBaseSocialAutomationInput = {
  tenantId: string;
  saasId: string;
  niche: string;
  tone: string;
  frequencyPerWeek: number;
};

export type CampoBaseSocialAutomationOutput = {
  campaignId: string;
  postsCount: number;
  scheduledCount: number;
  schedule: {
    postId: string;
    scheduledAt: string;
  }[];
};

export type CampoBaseSocialAutomationBatchItemResult = {
  tenantId: string;
  saasId: string;
  ok: boolean;
  campaignId: string | null;
  postsCount: number;
  scheduledCount: number;
  error: string | null;
};

export type CampoBaseSocialAutomationBatchOutput = {
  total: number;
  success: number;
  failed: number;
  results: CampoBaseSocialAutomationBatchItemResult[];
};

export type CampoBaseSocialAutomationStatusItem = {
  tenantId: string;
  saasId: string;
  enabled: boolean;
  niche: string;
  tone: string;
  frequencyPerWeek: number;
  updatedAt: string;
};

export type CampoBaseSocialAutomationStatusOutput = {
  total: number;
  enabled: number;
  disabled: number;
  items: CampoBaseSocialAutomationStatusItem[];
};

export type CampoBaseSocialAutomationToggleOutput = {
  tenantId: string;
  saasId: string;
  enabled: boolean;
  niche: string;
  tone: string;
  frequencyPerWeek: number;
  updatedAt: string;
};

function nowIso(): string {
  return new Date().toISOString();
}

async function recordRunSafe(input: Parameters<typeof recordCampoBaseSocialAutomationRun>[0]): Promise<void> {
  try {
    await recordCampoBaseSocialAutomationRun(input);
  } catch (error) {
    console.error("CAMPOBASE_SOCIAL_AUTOMATION_RUN_LOG_ERROR", error);
  }
}

export async function runCampoBaseSocialAutomation(
  input: CampoBaseSocialAutomationInput,
): Promise<CampoBaseSocialAutomationOutput> {
  const result = await runSocialFlowEngine({
    tenantId: input.tenantId,
    saasId: input.saasId,
    niche: input.niche,
    tone: input.tone,
    frequencyPerWeek: input.frequencyPerWeek,
  });

  return {
    campaignId: result.campaignId,
    postsCount: result.posts.length,
    scheduledCount: result.schedule.length,
    schedule: result.schedule,
  };
}

export async function runCampoBaseSocialAutomationForRegisteredSaas(
  tenantId: string,
  saasId: string,
): Promise<CampoBaseSocialAutomationOutput> {
  const startedAt = nowIso();
  const config = await getCampoBaseSocialAutomationRegistryItem(tenantId, saasId);

  if (!config) {
    await recordRunSafe({
      tenantId,
      saasId,
      status: "FAILED",
      campaignId: null,
      postsCount: 0,
      scheduledCount: 0,
      error: "NOT_CONFIGURED",
      startedAt,
      finishedAt: nowIso(),
      createdAt: startedAt,
    });
    throw new Error("NOT_CONFIGURED");
  }

  if (!config.enabled) {
    await recordRunSafe({
      tenantId,
      saasId,
      status: "FAILED",
      campaignId: null,
      postsCount: 0,
      scheduledCount: 0,
      error: "DISABLED",
      startedAt,
      finishedAt: nowIso(),
      createdAt: startedAt,
    });
    throw new Error("DISABLED");
  }

  try {
    const result = await runCampoBaseSocialAutomation({
      tenantId: config.tenantId,
      saasId: config.saasId,
      niche: config.niche,
      tone: config.tone,
      frequencyPerWeek: config.frequencyPerWeek,
    });
    await recordRunSafe({
      tenantId: config.tenantId,
      saasId: config.saasId,
      status: "SUCCESS",
      campaignId: result.campaignId,
      postsCount: result.postsCount,
      scheduledCount: result.scheduledCount,
      error: null,
      startedAt,
      finishedAt: nowIso(),
      createdAt: startedAt,
    });
    return result;
  } catch (error) {
    await recordRunSafe({
      tenantId: config.tenantId,
      saasId: config.saasId,
      status: "FAILED",
      campaignId: null,
      postsCount: 0,
      scheduledCount: 0,
      error: error instanceof Error ? error.message : "UNKNOWN_ERROR",
      startedAt,
      finishedAt: nowIso(),
      createdAt: startedAt,
    });
    throw error;
  }
}

export async function runCampoBaseSocialAutomationForAllRegisteredSaas(): Promise<CampoBaseSocialAutomationBatchOutput> {
  const items = await listEnabledCampoBaseSocialAutomationRegistryItems();
  return runCampoBaseSocialAutomationBatch(items);
}

export async function runCampoBaseSocialAutomationForSelectedSaas(
  saasIds: string[],
): Promise<CampoBaseSocialAutomationBatchOutput> {
  const items = await listEnabledCampoBaseSocialAutomationRegistryItems();
  const selected = items.filter((item) => saasIds.includes(item.saasId));
  return runCampoBaseSocialAutomationBatch(selected);
}

async function runCampoBaseSocialAutomationBatch(
  items: Array<{
    tenantId: string;
    saasId: string;
    niche: string;
    tone: string;
    frequencyPerWeek: number;
  }>,
): Promise<CampoBaseSocialAutomationBatchOutput> {
  const results: CampoBaseSocialAutomationBatchItemResult[] = [];

  for (const item of items) {
    const startedAt = nowIso();
    try {
      const result = await runCampoBaseSocialAutomation({
        tenantId: item.tenantId,
        saasId: item.saasId,
        niche: item.niche,
        tone: item.tone,
        frequencyPerWeek: item.frequencyPerWeek,
      });

      await recordRunSafe({
        tenantId: item.tenantId,
        saasId: item.saasId,
        status: "SUCCESS",
        campaignId: result.campaignId,
        postsCount: result.postsCount,
        scheduledCount: result.scheduledCount,
        error: null,
        startedAt,
        finishedAt: nowIso(),
        createdAt: startedAt,
      });

      results.push({
        tenantId: item.tenantId,
        saasId: item.saasId,
        ok: true,
        campaignId: result.campaignId,
        postsCount: result.postsCount,
        scheduledCount: result.scheduledCount,
        error: null,
      });
    } catch (error) {
      await recordRunSafe({
        tenantId: item.tenantId,
        saasId: item.saasId,
        status: "FAILED",
        campaignId: null,
        postsCount: 0,
        scheduledCount: 0,
        error: error instanceof Error ? error.message : "UNKNOWN_ERROR",
        startedAt,
        finishedAt: nowIso(),
        createdAt: startedAt,
      });
      results.push({
        tenantId: item.tenantId,
        saasId: item.saasId,
        ok: false,
        campaignId: null,
        postsCount: 0,
        scheduledCount: 0,
        error: error instanceof Error ? error.message : "UNKNOWN_ERROR",
      });
    }
  }

  return {
    total: results.length,
    success: results.filter((r) => r.ok).length,
    failed: results.filter((r) => !r.ok).length,
    results,
  };
}

export async function getCampoBaseSocialAutomationStatus(): Promise<CampoBaseSocialAutomationStatusOutput> {
  const items = await listCampoBaseSocialAutomationRegistryItems();
  const mapped: CampoBaseSocialAutomationStatusItem[] = items.map((item) => ({
    tenantId: item.tenantId,
    saasId: item.saasId,
    enabled: item.enabled,
    niche: item.niche,
    tone: item.tone,
    frequencyPerWeek: item.frequencyPerWeek,
    updatedAt: item.updatedAt,
  }));

  return {
    total: mapped.length,
    enabled: mapped.filter((item) => item.enabled).length,
    disabled: mapped.filter((item) => !item.enabled).length,
    items: mapped,
  };
}

export async function getCampoBaseSocialAutomationStatusForSaas(
  tenantId: string,
  saasId: string,
): Promise<CampoBaseSocialAutomationStatusItem | null> {
  const item = await getCampoBaseSocialAutomationRegistryItem(tenantId, saasId);

  if (!item) {
    return null;
  }

  return {
    tenantId: item.tenantId,
    saasId: item.saasId,
    enabled: item.enabled,
    niche: item.niche,
    tone: item.tone,
    frequencyPerWeek: item.frequencyPerWeek,
    updatedAt: item.updatedAt,
  };
}

export async function enableCampoBaseSocialAutomationForSaas(
  tenantId: string,
  saasId: string,
): Promise<CampoBaseSocialAutomationToggleOutput> {
  return setCampoBaseSocialAutomationState(tenantId, saasId, true);
}

export async function disableCampoBaseSocialAutomationForSaas(
  tenantId: string,
  saasId: string,
): Promise<CampoBaseSocialAutomationToggleOutput> {
  return setCampoBaseSocialAutomationState(tenantId, saasId, false);
}

export async function setCampoBaseSocialAutomationState(
  tenantId: string,
  saasId: string,
  enabled: boolean,
): Promise<CampoBaseSocialAutomationToggleOutput> {
  const item = await setCampoBaseSocialAutomationEnabled(tenantId, saasId, enabled);

  if (!item) {
    throw new Error("CAMPOBASE_SOCIAL_AUTOMATION_NOT_CONFIGURED");
  }

  return {
    tenantId: item.tenantId,
    saasId: item.saasId,
    enabled: item.enabled,
    niche: item.niche,
    tone: item.tone,
    frequencyPerWeek: item.frequencyPerWeek,
    updatedAt: item.updatedAt,
  };
}
