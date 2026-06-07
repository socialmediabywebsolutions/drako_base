import type {
  SocialAutomationHistoryRun,
  SocialAutomationHistoryStatus,
} from "@/lib/campamento-base/social-automation-history";
import {
  listSocialAutomationRuns,
  listSocialAutomationRunsForSaas,
  recordSocialAutomationRun,
} from "@/lib/campamento-base/social-automation-history";

// Legacy freeze note:
// - src/lib/campobase/ is frozen legacy namespace.
// - This file exists only as a temporary compatibility adapter.
// - Canonical module lives at src/lib/campamento-base/social-automation-history.ts.
// - Consumers are migrated file-by-file to canonical namespaces.

export type CampoBaseSocialAutomationRunStatus = Extract<
  SocialAutomationHistoryStatus,
  "SUCCESS" | "FAILED"
>;

export type CampoBaseSocialAutomationRun = {
  id: string;
  tenantId: string;
  saasId: string;
  status: CampoBaseSocialAutomationRunStatus;
  campaignId: string | null;
  postsCount: number;
  scheduledCount: number;
  error: string | null;
  startedAt: string;
  finishedAt: string;
  createdAt: string;
};

export type RecordCampoBaseSocialAutomationRunInput = {
  tenantId: string;
  saasId: string;
  status: CampoBaseSocialAutomationRunStatus;
  campaignId: string | null;
  postsCount: number;
  scheduledCount: number;
  error: string | null;
  startedAt: string;
  finishedAt: string;
  createdAt?: string;
};

const LEGACY_AUTOMATION_KEY = "campobase_social_automation_history_legacy_adapter";

function toLegacyStatus(status: SocialAutomationHistoryStatus): CampoBaseSocialAutomationRunStatus {
  return status === "FAILED" ? "FAILED" : "SUCCESS";
}

function toNumberOrZero(value: number | undefined): number {
  if (!Number.isFinite(value)) {
    return 0;
  }
  return Math.trunc(value as number);
}

function mapToLegacyRun(run: SocialAutomationHistoryRun): CampoBaseSocialAutomationRun {
  return {
    id: run.id,
    tenantId: run.tenantId,
    saasId: run.saasId,
    status: toLegacyStatus(run.status),
    campaignId: typeof run.result?.campaignId === "string" ? run.result.campaignId : null,
    postsCount: toNumberOrZero(run.result?.postsCount),
    scheduledCount: toNumberOrZero(run.result?.scheduledCount),
    error: run.error?.message ?? null,
    startedAt: run.startedAt,
    finishedAt: run.completedAt ?? run.startedAt,
    createdAt: run.createdAt,
  };
}

export async function recordCampoBaseSocialAutomationRun(
  input: RecordCampoBaseSocialAutomationRunInput,
): Promise<CampoBaseSocialAutomationRun> {
  if (input.status !== "SUCCESS" && input.status !== "FAILED") {
    throw new Error("INVALID_CAMPOBASE_SOCIAL_AUTOMATION_STATUS");
  }

  const run = await recordSocialAutomationRun({
    tenantId: input.tenantId,
    saasId: input.saasId,
    automationKey: LEGACY_AUTOMATION_KEY,
    status: input.status,
    startedAt: input.startedAt,
    completedAt: input.finishedAt,
    result: {
      campaignId: input.campaignId ?? null,
      postsCount: input.postsCount,
      scheduledCount: input.scheduledCount,
    },
    error: input.error
      ? {
          code: "CAMPOBASE_SOCIAL_AUTOMATION_ERROR",
          message: input.error,
        }
      : null,
    createdAt: input.createdAt,
  });

  return mapToLegacyRun(run);
}

export async function listCampoBaseSocialAutomationRuns(
  limit = 50,
): Promise<CampoBaseSocialAutomationRun[]> {
  const runs = await listSocialAutomationRuns({
    limit,
    automationKey: LEGACY_AUTOMATION_KEY,
  });
  return runs.map(mapToLegacyRun);
}

export async function listCampoBaseSocialAutomationRunsForSaas(
  tenantId: string,
  saasId: string,
  limit = 50,
): Promise<CampoBaseSocialAutomationRun[]> {
  const runs = await listSocialAutomationRunsForSaas({
    tenantId,
    saasId,
    limit,
    automationKey: LEGACY_AUTOMATION_KEY,
  });
  return runs.map(mapToLegacyRun);
}
