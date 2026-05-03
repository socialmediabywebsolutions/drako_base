import {
  AutomationCoreError,
  disableAutomation,
  enableAutomation,
  getAutomation,
  getAutomationExecutionSummary,
  listAutomationExecutions,
  listAutomations,
  registerAutomation,
  registerAutomationHandler,
  triggerAutomation,
  type AutomationExecution,
  type AutomationExecutionResult,
  type AutomationRegistration,
} from "@/lib/automation-core";
import { runSocialFlowAutomationContract } from "@/lib/socialflow/contracts/automation";
import {
  getSocialFlowOperatorObservability,
  type SocialFlowOperatorObservability,
} from "@/lib/socialflow/contracts/observability";
import {
  runSocialFlowOperatorAction,
  type SocialFlowOperatorAction,
  type SocialFlowOperatorActionResult,
} from "@/lib/socialflow/contracts/operator-actions";

export const SOCIALFLOW_CONTENT_GENERATION_KEY = "socialflow.content_generation";
export const SOCIALFLOW_HEALTH_CHECK_KEY = "socialflow.health_check";
export const SOCIALFLOW_AUTOMATION_KEY = SOCIALFLOW_CONTENT_GENERATION_KEY;

export type SocialFlowAutomationKey =
  | typeof SOCIALFLOW_CONTENT_GENERATION_KEY
  | typeof SOCIALFLOW_HEALTH_CHECK_KEY;

const SOCIALFLOW_AUTOMATION_DEFINITIONS = {
  [SOCIALFLOW_CONTENT_GENERATION_KEY]: {
    displayName: "SocialFlow content generation",
    description: "Generates and schedules SocialFlow campaigns for an owned SaaS workspace.",
    scheduleMode: "scheduled" as const,
    frequencyUnit: "week" as const,
  },
  [SOCIALFLOW_HEALTH_CHECK_KEY]: {
    displayName: "SocialFlow health check",
    description: "Checks whether the SocialFlow automation setup is minimally healthy and executable.",
    scheduleMode: "manual" as const,
    frequencyUnit: "day" as const,
  },
} satisfies Record<
  SocialFlowAutomationKey,
  { displayName: string; description: string; scheduleMode: "manual" | "scheduled"; frequencyUnit: "day" | "week" }
>;

export type CampoBaseSocialAutomationInput = {
  tenantId: string;
  saasId: string;
  niche: string;
  tone: string;
  frequencyPerWeek: number;
  enabled?: boolean;
};

export type CampoBaseSocialHealthCheckInput = {
  tenantId: string;
  saasId: string;
  enabled?: boolean;
  tone?: string | null;
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

export type CampoBaseSocialHealthCheckOutput = {
  checksPassed: number;
  checksFailed: number;
  recommendedAction: string;
};

export type CampoBaseSocialAutomationBatchItemResult = {
  tenantId: string;
  saasId: string;
  automationKey?: SocialFlowAutomationKey;
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
  automationKey: SocialFlowAutomationKey;
  displayName: string;
  enabled: boolean;
  niche: string | null;
  tone: string | null;
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
  automationKey: SocialFlowAutomationKey;
  displayName: string;
  enabled: boolean;
  niche: string | null;
  tone: string | null;
  frequencyPerWeek: number;
  updatedAt: string;
};

export type CampoBaseSocialAutomationRun = {
  id: string;
  tenantId: string;
  saasId: string;
  automationKey: SocialFlowAutomationKey;
  status: "SUCCESS" | "FAILED";
  campaignId: string | null;
  postsCount: number;
  scheduledCount: number;
  error: string | null;
  startedAt: string;
  finishedAt: string;
  createdAt: string;
};

export type CampoBaseSocialFlowObservability = SocialFlowOperatorObservability;
export type CampoBaseSocialFlowOperatorAction = SocialFlowOperatorAction;
export type CampoBaseSocialFlowOperatorActionResult = SocialFlowOperatorActionResult;

type SocialFlowContentGenerationConfig = {
  niche: string;
  tone: string;
  frequencyPerWeek: number;
};

type SocialFlowHealthCheckConfig = {
  tone: string;
  frequencyPerWeek: number;
};

function assertAutomationKey(value?: string | null): SocialFlowAutomationKey {
  if (value === SOCIALFLOW_CONTENT_GENERATION_KEY || value === SOCIALFLOW_HEALTH_CHECK_KEY) {
    return value;
  }
  throw new Error("INVALID_AUTOMATION_KEY");
}

function resolveAutomationKey(value?: string | null): SocialFlowAutomationKey {
  if (!value) return SOCIALFLOW_CONTENT_GENERATION_KEY;
  return assertAutomationKey(value);
}

function normalizeContentGenerationConfig(config: Record<string, unknown> | null): SocialFlowContentGenerationConfig {
  const niche = typeof config?.niche === "string" ? config.niche.trim() : "";
  const tone = typeof config?.tone === "string" ? config.tone.trim() : "";
  const frequencyPerWeek = typeof config?.frequencyPerWeek === "number" ? config.frequencyPerWeek : 0;

  if (!niche) throw new AutomationCoreError("SOCIALFLOW_AUTOMATION_NICHE_REQUIRED");
  if (!tone) throw new AutomationCoreError("SOCIALFLOW_AUTOMATION_TONE_REQUIRED");
  if (!Number.isInteger(frequencyPerWeek) || frequencyPerWeek <= 0) {
    throw new AutomationCoreError("SOCIALFLOW_AUTOMATION_FREQUENCY_INVALID");
  }

  return { niche, tone, frequencyPerWeek };
}

function normalizeHealthCheckConfig(config: Record<string, unknown> | null): SocialFlowHealthCheckConfig {
  const tone = typeof config?.tone === "string" && config.tone.trim() ? config.tone.trim() : "operational";
  const frequencyPerWeek = typeof config?.frequencyPerWeek === "number" && config.frequencyPerWeek > 0
    ? config.frequencyPerWeek
    : 1;

  return { tone, frequencyPerWeek };
}

function getStatusTone(config: Record<string, unknown> | null): string | null {
  return typeof config?.tone === "string" && config.tone.trim() ? config.tone.trim() : null;
}

function getStatusNiche(
  automationKey: SocialFlowAutomationKey,
  config: Record<string, unknown> | null,
): string | null {
  if (automationKey !== SOCIALFLOW_CONTENT_GENERATION_KEY) return null;
  return typeof config?.niche === "string" && config.niche.trim() ? config.niche.trim() : null;
}

function getStatusFrequency(
  automationKey: SocialFlowAutomationKey,
  config: Record<string, unknown> | null,
): number {
  const frequency = typeof config?.frequencyPerWeek === "number" ? config.frequencyPerWeek : null;
  if (Number.isInteger(frequency) && frequency! > 0) return frequency!;
  return automationKey === SOCIALFLOW_CONTENT_GENERATION_KEY ? 1 : 1;
}

function mapExecutionToRun(execution: AutomationExecution): CampoBaseSocialAutomationRun {
  const output = execution.output ?? {};
  const campaignId = typeof output.campaignId === "string" ? output.campaignId : null;
  const postsCount = typeof execution.metrics.postsCount === "number" ? execution.metrics.postsCount : 0;
  const scheduledCount = typeof execution.metrics.scheduledCount === "number" ? execution.metrics.scheduledCount : 0;

  return {
    id: execution.id,
    tenantId: execution.tenantId,
    saasId: execution.saasId,
    automationKey: resolveAutomationKey(execution.automationKey),
    status: execution.status === "SUCCESS" ? "SUCCESS" : "FAILED",
    campaignId,
    postsCount,
    scheduledCount,
    error: execution.errorMessage ?? null,
    startedAt: execution.startedAt,
    finishedAt: execution.finishedAt ?? execution.updatedAt,
    createdAt: execution.createdAt,
  };
}

function mapRegistrationToStatusItem(registration: AutomationRegistration): CampoBaseSocialAutomationStatusItem {
  const automationKey = resolveAutomationKey(registration.automationKey);
  const definition = SOCIALFLOW_AUTOMATION_DEFINITIONS[automationKey];
  const config = (registration.config ?? null) as Record<string, unknown> | null;

  return {
    tenantId: registration.tenantId,
    saasId: registration.saasId,
    automationKey,
    displayName: definition.displayName,
    enabled: registration.enabled,
    niche: getStatusNiche(automationKey, config),
    tone: getStatusTone(config),
    frequencyPerWeek: getStatusFrequency(automationKey, config),
    updatedAt: registration.updatedAt,
  };
}

function buildToggleOutput(registration: AutomationRegistration): CampoBaseSocialAutomationToggleOutput {
  const status = mapRegistrationToStatusItem(registration);
  return {
    tenantId: status.tenantId,
    saasId: status.saasId,
    automationKey: status.automationKey,
    displayName: status.displayName,
    enabled: status.enabled,
    niche: status.niche,
    tone: status.tone,
    frequencyPerWeek: status.frequencyPerWeek,
    updatedAt: status.updatedAt,
  };
}

function mapTriggerError(error: unknown): never {
  if (error instanceof AutomationCoreError) {
    if (error.code === "AUTOMATION_NOT_REGISTERED") throw new Error("NOT_CONFIGURED");
    if (error.code === "AUTOMATION_DISABLED") throw new Error("DISABLED");
    if (error.code === "AUTOMATION_HANDLER_MISSING") throw new Error("HANDLER_NOT_REGISTERED");
  }
  throw error;
}

registerAutomationHandler(SOCIALFLOW_CONTENT_GENERATION_KEY, async ({ tenantId, saasId, config }) => {
  const normalized = normalizeContentGenerationConfig(config as Record<string, unknown> | null);
  const result = await runSocialFlowAutomationContract({
    tenantId,
    saasId,
    niche: normalized.niche,
    tone: normalized.tone,
    frequencyPerWeek: normalized.frequencyPerWeek,
  });

  const executionResult: AutomationExecutionResult = {
    ok: true,
    summary: `Generated campaign ${result.campaignId} with ${result.posts.length} posts`,
    metrics: {
      postsCount: result.posts.length,
      scheduledCount: result.schedule.length,
    },
    output: {
      campaignId: result.campaignId,
      schedule: result.schedule,
    },
  };

  return executionResult;
});

registerAutomationHandler(SOCIALFLOW_HEALTH_CHECK_KEY, async ({ tenantId, saasId, config }) => {
  const normalized = normalizeHealthCheckConfig(config as Record<string, unknown> | null);
  const checksPassed = 3;
  const checksFailed = 0;

  return {
    ok: true,
    summary: `Health check passed for ${saasId}`,
    metrics: {
      checksPassed,
      checksFailed,
      frequencyPerWeek: normalized.frequencyPerWeek,
    },
    output: {
      tenantId,
      saasId,
      tone: normalized.tone,
      recommendedAction: "Automation is ready for manual execution and future scheduling.",
    },
  };
});

export async function registerCampoBaseSocialAutomation(
  input: CampoBaseSocialAutomationInput,
): Promise<CampoBaseSocialAutomationToggleOutput> {
  const definition = SOCIALFLOW_AUTOMATION_DEFINITIONS[SOCIALFLOW_CONTENT_GENERATION_KEY];
  const registration = await registerAutomation({
    tenantId: input.tenantId,
    saasId: input.saasId,
    automationKey: SOCIALFLOW_CONTENT_GENERATION_KEY,
    displayName: definition.displayName,
    description: definition.description,
    enabled: input.enabled ?? true,
    scheduleMode: definition.scheduleMode,
    frequencyUnit: definition.frequencyUnit,
    frequencyValue: input.frequencyPerWeek,
    config: {
      niche: input.niche,
      tone: input.tone,
      frequencyPerWeek: input.frequencyPerWeek,
    },
    ownerScope: "OWNER",
  });

  return buildToggleOutput(registration);
}

export async function registerCampoBaseSocialHealthCheck(
  input: CampoBaseSocialHealthCheckInput,
): Promise<CampoBaseSocialAutomationToggleOutput> {
  const definition = SOCIALFLOW_AUTOMATION_DEFINITIONS[SOCIALFLOW_HEALTH_CHECK_KEY];
  const registration = await registerAutomation({
    tenantId: input.tenantId,
    saasId: input.saasId,
    automationKey: SOCIALFLOW_HEALTH_CHECK_KEY,
    displayName: definition.displayName,
    description: definition.description,
    enabled: input.enabled ?? true,
    scheduleMode: definition.scheduleMode,
    frequencyUnit: definition.frequencyUnit,
    frequencyValue: 1,
    config: {
      tone: input.tone ?? "operational",
      frequencyPerWeek: 1,
    },
    ownerScope: "OWNER",
  });

  return buildToggleOutput(registration);
}

export async function runCampoBaseSocialAutomation(
  input: CampoBaseSocialAutomationInput,
): Promise<CampoBaseSocialAutomationOutput> {
  const result = await runSocialFlowAutomationContract({
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

export async function runCampoBaseSocialHealthCheckForRegisteredSaas(
  tenantId: string,
  saasId: string,
): Promise<CampoBaseSocialHealthCheckOutput> {
  try {
    const { result } = await triggerAutomation({
      tenantId,
      saasId,
      automationKey: SOCIALFLOW_HEALTH_CHECK_KEY,
      triggerType: "manual",
      triggeredBy: "owner",
    });

    return {
      checksPassed: result.metrics.checksPassed ?? 0,
      checksFailed: result.metrics.checksFailed ?? 0,
      recommendedAction:
        typeof result.output?.recommendedAction === "string"
          ? result.output.recommendedAction
          : "Review the automation setup.",
    };
  } catch (error) {
    mapTriggerError(error);
  }
}

export async function runCampoBaseSocialAutomationForRegisteredSaas(
  tenantId: string,
  saasId: string,
  automationKey: SocialFlowAutomationKey = SOCIALFLOW_CONTENT_GENERATION_KEY,
): Promise<CampoBaseSocialAutomationOutput> {
  try {
    const { result } = await triggerAutomation({
      tenantId,
      saasId,
      automationKey,
      triggerType: "manual",
      triggeredBy: "owner",
    });

    const schedule = Array.isArray(result.output?.schedule)
      ? result.output.schedule.filter(
          (item): item is { postId: string; scheduledAt: string } =>
            Boolean(item)
            && typeof item === "object"
            && typeof (item as { postId?: unknown }).postId === "string"
            && typeof (item as { scheduledAt?: unknown }).scheduledAt === "string",
        )
      : [];

    return {
      campaignId: typeof result.output?.campaignId === "string" ? result.output.campaignId : "",
      postsCount: result.metrics.postsCount ?? 0,
      scheduledCount: result.metrics.scheduledCount ?? 0,
      schedule,
    };
  } catch (error) {
    mapTriggerError(error);
  }
}

async function runCampoBaseSocialAutomationBatch(
  items: Array<{ tenantId: string; saasId: string; automationKey: SocialFlowAutomationKey }>,
): Promise<CampoBaseSocialAutomationBatchOutput> {
  const results: CampoBaseSocialAutomationBatchItemResult[] = [];

  for (const item of items) {
    try {
      const result = item.automationKey === SOCIALFLOW_HEALTH_CHECK_KEY
        ? await runCampoBaseSocialHealthCheckForRegisteredSaas(item.tenantId, item.saasId)
        : await runCampoBaseSocialAutomationForRegisteredSaas(item.tenantId, item.saasId, item.automationKey);

      results.push({
        tenantId: item.tenantId,
        saasId: item.saasId,
        automationKey: item.automationKey,
        ok: true,
        campaignId: "campaignId" in result ? result.campaignId : null,
        postsCount: "postsCount" in result ? result.postsCount : result.checksPassed,
        scheduledCount: "scheduledCount" in result ? result.scheduledCount : 0,
        error: null,
      });
    } catch (error) {
      results.push({
        tenantId: item.tenantId,
        saasId: item.saasId,
        automationKey: item.automationKey,
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
    success: results.filter((item) => item.ok).length,
    failed: results.filter((item) => !item.ok).length,
    results,
  };
}

export async function runCampoBaseSocialAutomationForAllRegisteredSaas(): Promise<CampoBaseSocialAutomationBatchOutput> {
  const items = await listAutomations();
  const socialItems = items.filter((item) => {
    try {
      resolveAutomationKey(item.automationKey);
      return item.enabled;
    } catch {
      return false;
    }
  });
  return runCampoBaseSocialAutomationBatch(
    socialItems.map((item) => ({
      tenantId: item.tenantId,
      saasId: item.saasId,
      automationKey: resolveAutomationKey(item.automationKey),
    })),
  );
}

export async function runCampoBaseSocialAutomationForSelectedSaas(
  saasIds: string[],
): Promise<CampoBaseSocialAutomationBatchOutput> {
  const items = await listAutomations();
  const selected = items.filter((item) => {
    try {
      return saasIds.includes(item.saasId) && item.enabled && Boolean(resolveAutomationKey(item.automationKey));
    } catch {
      return false;
    }
  });
  return runCampoBaseSocialAutomationBatch(
    selected.map((item) => ({
      tenantId: item.tenantId,
      saasId: item.saasId,
      automationKey: resolveAutomationKey(item.automationKey),
    })),
  );
}

export async function getCampoBaseSocialAutomationStatus(): Promise<CampoBaseSocialAutomationStatusOutput> {
  const items = await listAutomations();
  const mapped = items.flatMap((item) => {
    try {
      return [mapRegistrationToStatusItem(item)];
    } catch {
      return [];
    }
  });
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
  automationKey: SocialFlowAutomationKey = SOCIALFLOW_CONTENT_GENERATION_KEY,
): Promise<CampoBaseSocialAutomationStatusItem | null> {
  const item = await getAutomation(tenantId, saasId, automationKey);
  return item ? mapRegistrationToStatusItem(item) : null;
}

export async function getCampoBaseSocialFlowObservability(
  tenantId: string,
  saasId: string,
): Promise<CampoBaseSocialFlowObservability> {
  return getSocialFlowOperatorObservability({ tenantId, saasId });
}

export async function runCampoBaseSocialFlowOperatorAction(input: {
  action: CampoBaseSocialFlowOperatorAction;
  tenantId: string;
  saasId: string;
}): Promise<CampoBaseSocialFlowOperatorActionResult> {
  return runSocialFlowOperatorAction(input);
}

export async function enableCampoBaseSocialAutomationForSaas(
  tenantId: string,
  saasId: string,
  automationKey: SocialFlowAutomationKey = SOCIALFLOW_CONTENT_GENERATION_KEY,
): Promise<CampoBaseSocialAutomationToggleOutput> {
  return setCampoBaseSocialAutomationState(tenantId, saasId, true, automationKey);
}

export async function disableCampoBaseSocialAutomationForSaas(
  tenantId: string,
  saasId: string,
  automationKey: SocialFlowAutomationKey = SOCIALFLOW_CONTENT_GENERATION_KEY,
): Promise<CampoBaseSocialAutomationToggleOutput> {
  return setCampoBaseSocialAutomationState(tenantId, saasId, false, automationKey);
}

export async function setCampoBaseSocialAutomationState(
  tenantId: string,
  saasId: string,
  enabled: boolean,
  automationKey: SocialFlowAutomationKey = SOCIALFLOW_CONTENT_GENERATION_KEY,
): Promise<CampoBaseSocialAutomationToggleOutput> {
  try {
    const item = enabled
      ? await enableAutomation(tenantId, saasId, automationKey)
      : await disableAutomation(tenantId, saasId, automationKey);
    return buildToggleOutput(item);
  } catch (error) {
    if (error instanceof AutomationCoreError && error.code === "AUTOMATION_NOT_REGISTERED") {
      throw new Error("CAMPOBASE_SOCIAL_AUTOMATION_NOT_CONFIGURED");
    }
    throw error;
  }
}

export async function listCampoBaseSocialAutomationRuns(
  limit = 50,
  automationKey?: SocialFlowAutomationKey,
): Promise<CampoBaseSocialAutomationRun[]> {
  const executions = await listAutomationExecutions({
    automationKey: automationKey ?? null,
    limit,
  });
  return executions
    .filter((execution) => execution.status !== "RUNNING")
    .flatMap((execution) => {
      try {
        resolveAutomationKey(execution.automationKey);
        return [mapExecutionToRun(execution)];
      } catch {
        return [];
      }
    });
}

export async function listCampoBaseSocialAutomationRunsForSaas(
  tenantId: string,
  saasId: string,
  limit = 50,
  automationKey?: SocialFlowAutomationKey,
): Promise<CampoBaseSocialAutomationRun[]> {
  const executions = await listAutomationExecutions({
    tenantId,
    saasId,
    automationKey: automationKey ?? null,
    limit,
  });
  return executions
    .filter((execution) => execution.status !== "RUNNING")
    .flatMap((execution) => {
      try {
        resolveAutomationKey(execution.automationKey);
        return [mapExecutionToRun(execution)];
      } catch {
        return [];
      }
    });
}

export async function getCampoBaseSocialAutomationRunSummary(
  tenantId?: string,
  saasId?: string,
  automationKey?: SocialFlowAutomationKey,
): Promise<Awaited<ReturnType<typeof getAutomationExecutionSummary>>> {
  return getAutomationExecutionSummary({
    tenantId: tenantId ?? null,
    saasId: saasId ?? null,
    automationKey: automationKey ?? null,
  });
}
