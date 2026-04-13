import { env as resolveEnv } from "@/lib/cf";
import { listFactorySaas, type FactorySaasRecord } from "@/lib/factory/registry";
import { WhatsAppService, type WhatsAppServiceConfig } from "@/lib/notifications/whatsapp-service";
import {
  listObservabilityActivities,
  recordObservabilityActivity,
  type ObservabilityActivity,
  type ObservabilityActivityStatus,
} from "@/lib/observability-core";
import { listWhatsappIdentities, resolveWhatsappContext } from "@/lib/whatsapp/repository";
import type { WhatsappIdentity } from "@/lib/whatsapp/types";

const OPERATOR_WHATSAPP_SOURCE_KEY = "campamento-base.operator-whatsapp";
const OPERATOR_CONTEXT_SAAS_ID = "campamento-base";
const OPERATOR_IDENTITY_PRIORITY: WhatsappIdentity["actorType"][] = ["PLATFORM_OWNER", "SAAS_OWNER"];
const DAILY_ACTIVITY_LIMIT = 25;
const REALTIME_ACTIVITY_LIMIT = 50;
const REALTIME_DEDUPE_WINDOW_MS = 15 * 60 * 1000;

export type SendOperatorDailyWhatsappSummaryInput = {
  operatorTenantId: string;
};

export type SendOperatorRealtimeWhatsappAlertInput = {
  operatorTenantId: string;
  saasId: string;
};

export type OperatorDailyWhatsappSummaryResult = {
  sent: boolean;
  saasCount: number;
  errorsCount: number;
  signalsCount: number;
  messageId: string | null;
  status: string | null;
};

export type OperatorRealtimeWhatsappAlertResult = {
  sent: boolean;
  deduplicated: boolean;
  saasId: string;
  activityType: string | null;
  activityCreatedAt: string | null;
  messageId: string | null;
  status: string | null;
  reason?: "SAAS_NOT_VISIBLE" | "NO_RELEVANT_ACTIVITY";
};

export type OperatorMentoriaRealtimeTriggerResult = {
  triggered: boolean;
  reason?: "NOT_MENTORIA" | "NOT_CRITICAL" | "MISSING_SAAS_ID";
  alert?: OperatorRealtimeWhatsappAlertResult;
};

type OperatorVisibleSaas = Pick<FactorySaasRecord, "saasId" | "displayName" | "metadata">;

type DailySummarySaasBlock = {
  saasId: string;
  displayName: string;
  errorsCount: number;
  signalsCount: number;
  latestActivity: ObservabilityActivity | null;
};

type ReadEnvRecord = Record<string, string | undefined>;

function normalizeString(value: string | null | undefined): string {
  return typeof value === "string" ? value.trim() : "";
}

function parseDateOrNull(value: string | null | undefined): number | null {
  if (!value) return null;
  const parsed = Date.parse(value);
  return Number.isFinite(parsed) ? parsed : null;
}

function getOperatorTenantId(metadata: Record<string, unknown> | null): string | null {
  const tenantId = metadata && typeof metadata.operatorTenantId === "string"
    ? metadata.operatorTenantId.trim()
    : "";
  return tenantId || null;
}

function isSignalActivity(activity: ObservabilityActivity): boolean {
  return activity.activityType.startsWith("signal_");
}

function isRelevantRealtimeActivity(activity: ObservabilityActivity): boolean {
  return activity.status === "error" || isSignalActivity(activity);
}

function pickLatestRelevantRealtimeActivity(activities: ObservabilityActivity[]): ObservabilityActivity | null {
  return activities.find((activity) => isRelevantRealtimeActivity(activity)) ?? null;
}

function toRecord(value: unknown): Record<string, unknown> | null {
  return value && typeof value === "object" && !Array.isArray(value)
    ? value as Record<string, unknown>
    : null;
}

function readEnvVar(names: string[]): string | null {
  const runtimeEnv = (resolveEnv() ?? {}) as Record<string, unknown>;
  const processEnv = (typeof process !== "undefined" ? process.env : {}) as ReadEnvRecord;

  for (const name of names) {
    const fromRuntime = runtimeEnv[name];
    if (typeof fromRuntime === "string" && fromRuntime.trim()) {
      return fromRuntime.trim();
    }

    const fromProcess = processEnv[name];
    if (typeof fromProcess === "string" && fromProcess.trim()) {
      return fromProcess.trim();
    }
  }

  return null;
}

function resolveWhatsappServiceConfig(): WhatsAppServiceConfig {
  const providerRaw = (readEnvVar(["WHATSAPP_PROVIDER"]) ?? "mock").toLowerCase();

  if (providerRaw === "twilio") {
    const accountSid = readEnvVar(["TWILIO_ACCOUNT_SID"]);
    const authToken = readEnvVar(["TWILIO_AUTH_TOKEN"]);
    const apiKey =
      readEnvVar(["WHATSAPP_API_KEY"])
      ?? (accountSid && authToken ? `${accountSid}:${authToken}` : null)
      ?? "test-key";

    return {
      provider: "twilio",
      apiKey,
      apiSecret: readEnvVar(["WHATSAPP_API_SECRET"]) ?? authToken ?? undefined,
      phoneNumber: readEnvVar(["TWILIO_WHATSAPP_FROM", "WHATSAPP_PHONE_NUMBER"]) ?? undefined,
    };
  }

  if (providerRaw === "meta") {
    return {
      provider: "meta",
      apiKey: readEnvVar(["WHATSAPP_API_KEY", "META_WHATSAPP_ACCESS_TOKEN"]) ?? "test-key",
      businessAccountId: readEnvVar(["WHATSAPP_BUSINESS_ACCOUNT_ID", "WHATSAPP_PHONE_NUMBER_ID"]) ?? undefined,
    };
  }

  return {
    provider: "mock",
    apiKey: readEnvVar(["WHATSAPP_API_KEY"]) ?? "test-key",
  };
}

function resolveOwnerIdentity(identities: WhatsappIdentity[]): WhatsappIdentity | null {
  for (const actorType of OPERATOR_IDENTITY_PRIORITY) {
    const found = identities.find((identity) => identity.actorType === actorType);
    if (found) {
      return found;
    }
  }
  return null;
}

export async function recordOperatorWhatsappActivity(params: {
  operatorTenantId: string;
  saasId: string;
  activityType:
    | "operator_whatsapp_daily_summary_sent"
    | "operator_whatsapp_daily_summary_failed"
    | "operator_whatsapp_realtime_alert_sent"
    | "operator_whatsapp_realtime_alert_failed"
    | "operator_whatsapp_owner_identity_missing";
  status: ObservabilityActivityStatus;
  summary: string;
  metadata?: Record<string, unknown> | null;
}): Promise<void> {
  try {
    await recordObservabilityActivity({
      tenantId: params.operatorTenantId,
      saasId: params.saasId,
      sourceType: "integration",
      sourceKey: OPERATOR_WHATSAPP_SOURCE_KEY,
      activityType: params.activityType,
      status: params.status,
      summary: params.summary,
      metadata: params.metadata ?? null,
    });
  } catch (error) {
    console.error("OPERATOR_WHATSAPP_OBSERVABILITY_ACTIVITY_ERROR", error);
  }
}

export async function resolveOperatorWhatsappPhone(params: {
  operatorTenantId: string;
}): Promise<{ phoneNumber: string; identity: WhatsappIdentity }> {
  const whatsappCtx = await resolveWhatsappContext({
    tenantId: params.operatorTenantId,
    saasId: OPERATOR_CONTEXT_SAAS_ID,
  });
  const identities = await listWhatsappIdentities(whatsappCtx);
  const ownerIdentity = resolveOwnerIdentity(identities);

  if (!ownerIdentity) {
    await recordOperatorWhatsappActivity({
      operatorTenantId: params.operatorTenantId,
      saasId: OPERATOR_CONTEXT_SAAS_ID,
      activityType: "operator_whatsapp_owner_identity_missing",
      status: "error",
      summary: "Operator WhatsApp owner identity is missing in saas_whatsapp_identities.",
      metadata: {
        expectedActorTypes: OPERATOR_IDENTITY_PRIORITY,
        contextSaasId: OPERATOR_CONTEXT_SAAS_ID,
      },
    });
    throw new Error("OPERATOR_WHATSAPP_OWNER_PHONE_MISSING");
  }

  return {
    phoneNumber: ownerIdentity.phoneNumber,
    identity: ownerIdentity,
  };
}

export async function listOperatorVisibleSaas(params: {
  operatorTenantId: string;
}): Promise<OperatorVisibleSaas[]> {
  const saases = await listFactorySaas({ status: "ACTIVE" });
  return saases.filter((item) => {
    if (!item.supportsOperatorSurface) {
      return false;
    }

    const operatorTenantId = getOperatorTenantId(item.metadata);
    return operatorTenantId === params.operatorTenantId;
  });
}

export function buildDailySummaryMessage(params: {
  blocks: DailySummarySaasBlock[];
  totals: {
    saasCount: number;
    errorsCount: number;
    signalsCount: number;
  };
}): string {
  const headline = `Campamento Base operador - resumen diario`;
  const totals = `SaaS: ${params.totals.saasCount} | errores: ${params.totals.errorsCount} | senales: ${params.totals.signalsCount}`;

  if (params.blocks.length === 0) {
    return `${headline}\n${totals}\nSin SaaS activos con superficie de operador.`;
  }

  const lines = params.blocks.slice(0, 8).map((block) => {
    const latest = block.latestActivity
      ? `${block.latestActivity.activityType} (${block.latestActivity.status})`
      : "sin actividad";
    return `- ${block.displayName} [${block.saasId}]: errores=${block.errorsCount}, senales=${block.signalsCount}, ultima=${latest}`;
  });

  if (params.blocks.length > 8) {
    lines.push(`- +${params.blocks.length - 8} SaaS adicionales`);
  }

  return [headline, totals, ...lines].join("\n");
}

export function buildRealtimeAlertMessage(params: {
  saasId: string;
  saasDisplayName: string;
  activity: ObservabilityActivity;
}): string {
  const createdAt = params.activity.createdAt.replace("T", " ").slice(0, 16);
  return [
    `ALERTA operator WhatsApp`,
    `SaaS: ${params.saasDisplayName} [${params.saasId}]`,
    `Tipo: ${params.activity.activityType}`,
    `Estado: ${params.activity.status}`,
    `Hora: ${createdAt} UTC`,
    `Resumen: ${params.activity.summary}`,
  ].join("\n");
}

export async function sendOperatorWhatsappMessage(params: {
  phoneNumber: string;
  body: string;
}): Promise<{ messageId: string; status: string }> {
  const service = new WhatsAppService(resolveWhatsappServiceConfig());
  return service.sendMessage({
    to: params.phoneNumber,
    body: params.body,
  });
}

async function hasRecentRealtimeDuplicate(params: {
  operatorTenantId: string;
  saasId: string;
  activity: ObservabilityActivity;
}): Promise<boolean> {
  const recentSends = await listObservabilityActivities({
    tenantId: params.operatorTenantId,
    saasId: params.saasId,
    sourceType: "integration",
    sourceKey: OPERATOR_WHATSAPP_SOURCE_KEY,
    limit: 100,
  });

  const now = Date.now();
  const cutoff = now - REALTIME_DEDUPE_WINDOW_MS;

  return recentSends.some((activity) => {
    if (activity.activityType !== "operator_whatsapp_realtime_alert_sent") {
      return false;
    }

    const activityTime = parseDateOrNull(activity.createdAt);
    if (activityTime === null || activityTime < cutoff) {
      return false;
    }

    const metadata = toRecord(activity.metadata);
    if (!metadata) {
      return false;
    }

    const targetSaasId = normalizeString(typeof metadata.targetSaasId === "string" ? metadata.targetSaasId : "");
    const targetActivityType = normalizeString(
      typeof metadata.targetActivityType === "string" ? metadata.targetActivityType : "",
    );
    const targetActivityCreatedAt = normalizeString(
      typeof metadata.targetActivityCreatedAt === "string" ? metadata.targetActivityCreatedAt : "",
    );

    return targetSaasId === params.saasId
      && targetActivityType === params.activity.activityType
      && targetActivityCreatedAt === params.activity.createdAt;
  });
}

export async function sendOperatorDailyWhatsappSummary(
  input: SendOperatorDailyWhatsappSummaryInput,
): Promise<OperatorDailyWhatsappSummaryResult> {
  const operatorTenantId = normalizeString(input.operatorTenantId);
  if (!operatorTenantId) {
    throw new Error("OPERATOR_TENANT_ID_REQUIRED");
  }

  try {
    const visibleSaas = await listOperatorVisibleSaas({ operatorTenantId });
    const blocks = await Promise.all(
      visibleSaas.map(async (item) => {
        const activities = await listObservabilityActivities({
          tenantId: operatorTenantId,
          saasId: item.saasId,
          limit: DAILY_ACTIVITY_LIMIT,
        });

        return {
          saasId: item.saasId,
          displayName: item.displayName,
          errorsCount: activities.filter((activity) => activity.status === "error").length,
          signalsCount: activities.filter((activity) => isSignalActivity(activity)).length,
          latestActivity: activities[0] ?? null,
        } satisfies DailySummarySaasBlock;
      }),
    );

    const totals = {
      saasCount: blocks.length,
      errorsCount: blocks.reduce((acc, block) => acc + block.errorsCount, 0),
      signalsCount: blocks.reduce((acc, block) => acc + block.signalsCount, 0),
    };

    const message = buildDailySummaryMessage({ blocks, totals });
    const owner = await resolveOperatorWhatsappPhone({ operatorTenantId });
    const sendResult = await sendOperatorWhatsappMessage({
      phoneNumber: owner.phoneNumber,
      body: message,
    });

    await recordOperatorWhatsappActivity({
      operatorTenantId,
      saasId: OPERATOR_CONTEXT_SAAS_ID,
      activityType: "operator_whatsapp_daily_summary_sent",
      status: "success",
      summary: `Operator WhatsApp daily summary sent to ${owner.identity.actorType}.`,
      metadata: {
        sentTo: owner.phoneNumber,
        totals,
        messageId: sendResult.messageId,
        messageStatus: sendResult.status,
      },
    });

    return {
      sent: true,
      saasCount: totals.saasCount,
      errorsCount: totals.errorsCount,
      signalsCount: totals.signalsCount,
      messageId: sendResult.messageId,
      status: sendResult.status,
    };
  } catch (error) {
    await recordOperatorWhatsappActivity({
      operatorTenantId,
      saasId: OPERATOR_CONTEXT_SAAS_ID,
      activityType: "operator_whatsapp_daily_summary_failed",
      status: "error",
      summary: "Operator WhatsApp daily summary failed.",
      metadata: {
        error: error instanceof Error ? error.message : String(error),
      },
    });
    throw error;
  }
}

export async function triggerOperatorRealtimeWhatsappAlertForMentoriaEvent(input: {
  operatorTenantId: string;
  eventType: string;
  severity: string;
  saasId: string | null;
}): Promise<OperatorMentoriaRealtimeTriggerResult> {
  const eventType = normalizeString(input.eventType);
  const severity = normalizeString(input.severity).toLowerCase();
  const saasId = normalizeString(input.saasId ?? "");

  if (!eventType.startsWith("mentoria.system.")) {
    return { triggered: false, reason: "NOT_MENTORIA" };
  }

  if (severity !== "critical") {
    return { triggered: false, reason: "NOT_CRITICAL" };
  }

  if (!saasId) {
    return { triggered: false, reason: "MISSING_SAAS_ID" };
  }

  const alert = await sendOperatorRealtimeWhatsappAlert({
    operatorTenantId: input.operatorTenantId,
    saasId,
  });

  return { triggered: true, alert };
}

export async function sendOperatorRealtimeWhatsappAlert(
  input: SendOperatorRealtimeWhatsappAlertInput,
): Promise<OperatorRealtimeWhatsappAlertResult> {
  const operatorTenantId = normalizeString(input.operatorTenantId);
  const saasId = normalizeString(input.saasId);

  if (!operatorTenantId) {
    throw new Error("OPERATOR_TENANT_ID_REQUIRED");
  }

  if (!saasId) {
    throw new Error("OPERATOR_WHATSAPP_SAAS_ID_REQUIRED");
  }

  try {
    const visibleSaas = await listOperatorVisibleSaas({ operatorTenantId });
    const targetSaas = visibleSaas.find((item) => item.saasId === saasId) ?? null;

    if (!targetSaas) {
      return {
        sent: false,
        deduplicated: false,
        saasId,
        activityType: null,
        activityCreatedAt: null,
        messageId: null,
        status: null,
        reason: "SAAS_NOT_VISIBLE",
      };
    }

    const activities = await listObservabilityActivities({
      tenantId: operatorTenantId,
      saasId,
      limit: REALTIME_ACTIVITY_LIMIT,
    });

    const activity = pickLatestRelevantRealtimeActivity(activities);
    if (!activity) {
      return {
        sent: false,
        deduplicated: false,
        saasId,
        activityType: null,
        activityCreatedAt: null,
        messageId: null,
        status: null,
        reason: "NO_RELEVANT_ACTIVITY",
      };
    }

    const deduplicated = await hasRecentRealtimeDuplicate({ operatorTenantId, saasId, activity });
    if (deduplicated) {
      return {
        sent: false,
        deduplicated: true,
        saasId,
        activityType: activity.activityType,
        activityCreatedAt: activity.createdAt,
        messageId: null,
        status: null,
      };
    }

    const owner = await resolveOperatorWhatsappPhone({ operatorTenantId });
    const message = buildRealtimeAlertMessage({
      saasId,
      saasDisplayName: targetSaas.displayName,
      activity,
    });
    const sendResult = await sendOperatorWhatsappMessage({
      phoneNumber: owner.phoneNumber,
      body: message,
    });

    await recordOperatorWhatsappActivity({
      operatorTenantId,
      saasId,
      activityType: "operator_whatsapp_realtime_alert_sent",
      status: "success",
      summary: `Operator WhatsApp realtime alert sent for ${saasId}.`,
      metadata: {
        sentTo: owner.phoneNumber,
        targetSaasId: saasId,
        targetActivityType: activity.activityType,
        targetActivityCreatedAt: activity.createdAt,
        targetActivityStatus: activity.status,
        messageId: sendResult.messageId,
        messageStatus: sendResult.status,
      },
    });

    return {
      sent: true,
      deduplicated: false,
      saasId,
      activityType: activity.activityType,
      activityCreatedAt: activity.createdAt,
      messageId: sendResult.messageId,
      status: sendResult.status,
    };
  } catch (error) {
    await recordOperatorWhatsappActivity({
      operatorTenantId,
      saasId,
      activityType: "operator_whatsapp_realtime_alert_failed",
      status: "error",
      summary: `Operator WhatsApp realtime alert failed for ${saasId}.`,
      metadata: {
        error: error instanceof Error ? error.message : String(error),
      },
    });
    throw error;
  }
}
