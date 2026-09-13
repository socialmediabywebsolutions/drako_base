export const dynamic = "force-dynamic";

import { NextResponse } from "next/server";
import { requireOwnerAccess, UnauthorizedError } from "@/lib/auth/session";
import {
  disableCampoBaseSocialAutomationForSaas,
  enableCampoBaseSocialAutomationForSaas,
  getCampoBaseSocialAutomationStatus,
  getCampoBaseSocialFlowObservability,
  getCampoBaseSocialFlowTrendTriggers,
  listCampoBaseSocialAutomationRuns,
  listCampoBaseSocialAutomationRunsForSaas,
  registerCampoBaseSocialAutomation,
  registerCampoBaseSocialHealthCheck,
  runCampoBaseSocialAutomationForAllRegisteredSaas,
  runCampoBaseSocialHealthCheckForRegisteredSaas,
  runCampoBaseSocialAutomationForRegisteredSaas,
  runCampoBaseSocialFlowOperatorAction,
  type CampoBaseSocialFlowOperatorAction,
  type SocialFlowAutomationKey,
} from "@/lib/campamento-base/socialflow-control-plane-service";
import { getCampoBaseAgentControlCenter } from "@/lib/campamento-base/socialflow-agent-control-center";
import { getChannelKnowledge } from "@/lib/socialflow/profile/repository";
import { getKnowledgeContext } from "@/lib/socialflow/knowledge/repository";
import { generateConversationalReply } from "@/lib/socialflow/conversational/engine";
import { BLOCKED_INTENT_REPLY, detectBlockedIntent } from "@/lib/socialflow/conversational/blocked-intent";
import type { ConversationThreadType } from "@/lib/socialflow/conversational/types";

type SocialFlowRouteAction =
  | { action: "run_all" }
  | { action: "run_one"; tenantId: string; saasId: string; automationKey?: SocialFlowAutomationKey }
  | { action: "register"; tenantId: string; saasId: string; niche: string; tone: string; frequencyPerWeek: number; enabled?: boolean; automationKey?: SocialFlowAutomationKey }
  | { action: "register_health"; tenantId: string; saasId: string; tone?: string; enabled?: boolean; automationKey?: SocialFlowAutomationKey }
  | { action: "enable"; tenantId: string; saasId: string; automationKey?: SocialFlowAutomationKey }
  | { action: "disable"; tenantId: string; saasId: string; automationKey?: SocialFlowAutomationKey }
  | { action: "linkedin_health_check"; tenantId: string; saasId: string }
  | { action: "refresh_observability"; tenantId: string; saasId: string }
  | {
      action: "test_ai_reply";
      tenantId: string;
      saasId: string;
      message: string;
      threadType: ConversationThreadType;
      provider: string;
      niche?: string;
    }
  | { action: CampoBaseSocialFlowOperatorAction; tenantId: string; saasId: string };

function validateAction(body: unknown): SocialFlowRouteAction | null {
  if (!body || typeof body !== "object") {
    return null;
  }

  const action = "action" in body ? body.action : null;
  const tenantId = "tenantId" in body ? body.tenantId : null;
  const saasId = "saasId" in body ? body.saasId : null;
  const niche = "niche" in body ? body.niche : null;
  const tone = "tone" in body ? body.tone : null;
  const frequencyPerWeek = "frequencyPerWeek" in body ? body.frequencyPerWeek : null;
  const enabled = "enabled" in body ? body.enabled : undefined;
  const automationKey =
    "automationKey" in body && typeof body.automationKey === "string"
      ? body.automationKey as SocialFlowAutomationKey
      : undefined;
  const message = "message" in body ? body.message : null;
  const threadType = "threadType" in body ? body.threadType : null;
  const provider = "provider" in body ? body.provider : null;

  if (action === "run_all") {
    return { action };
  }

  if (
    action === "register"
    && typeof tenantId === "string"
    && typeof saasId === "string"
    && typeof niche === "string"
    && typeof tone === "string"
    && typeof frequencyPerWeek === "number"
  ) {
    return {
      action,
      tenantId,
      saasId,
      niche,
      tone,
      frequencyPerWeek,
      enabled: typeof enabled === "boolean" ? enabled : undefined,
      automationKey,
    };
  }

  if (
    action === "register_health"
    && typeof tenantId === "string"
    && typeof saasId === "string"
  ) {
    return {
      action,
      tenantId,
      saasId,
      tone: typeof tone === "string" ? tone : undefined,
      enabled: typeof enabled === "boolean" ? enabled : undefined,
      automationKey,
    };
  }

  if (
    (action === "run_one" || action === "enable" || action === "disable")
    && typeof tenantId === "string"
    && typeof saasId === "string"
  ) {
    return { action, tenantId, saasId, automationKey };
  }

  if (
    (
      action === "linkedin_health_check"
      || action === "refresh_observability"
      || action === "recover_stale_publishing"
      || action === "retry_failed_posts"
    )
    && typeof tenantId === "string"
    && typeof saasId === "string"
  ) {
    return { action, tenantId, saasId };
  }

  if (
    action === "test_ai_reply"
    && typeof tenantId === "string"
    && typeof saasId === "string"
    && typeof message === "string"
  ) {
    return {
      action,
      tenantId,
      saasId,
      message,
      threadType: threadType === "COMMENT" ? "COMMENT" : "DM",
      provider: typeof provider === "string" && provider ? provider : "INSTAGRAM",
      niche: typeof niche === "string" && niche.trim() ? niche.trim() : undefined,
    };
  }

  return null;
}

function resolveActionError(error: unknown): { status: number; code: string; message: string } {
  const message = error instanceof Error ? error.message : "UNKNOWN_ERROR";

  if (message === "NOT_CONFIGURED") {
    return { status: 404, code: "CAMPOBASE_SOCIALFLOW_NOT_CONFIGURED", message };
  }

  if (message === "DISABLED") {
    return { status: 409, code: "CAMPOBASE_SOCIALFLOW_DISABLED", message };
  }

  if (message === "CAMPOBASE_SOCIAL_AUTOMATION_NOT_CONFIGURED") {
    return { status: 404, code: "CAMPOBASE_SOCIALFLOW_NOT_CONFIGURED", message };
  }

  return { status: 500, code: "CAMPOBASE_SOCIALFLOW_UNEXPECTED_ERROR", message };
}

function parseStatusFilter(value: string | null): "SUCCESS" | "FAILED" | null {
  if (value === "SUCCESS" || value === "FAILED") {
    return value;
  }

  return null;
}

function parseDateFilter(value: string | null, endOfDay = false): number | null {
  if (!value) {
    return null;
  }

  const trimmed = value.trim();
  if (!trimmed) {
    return null;
  }

  const parsed = new Date(trimmed);
  if (Number.isNaN(parsed.getTime())) {
    return null;
  }

  let timestamp = parsed.getTime();
  if (endOfDay && /^\d{4}-\d{2}-\d{2}$/.test(trimmed)) {
    timestamp += 24 * 60 * 60 * 1000 - 1;
  }

  return timestamp;
}

function filterHistory<T extends { status: string; createdAt: string }>(
  history: T[],
  options: {
    status?: "SUCCESS" | "FAILED" | null;
    dateFrom?: number | null;
    dateTo?: number | null;
    limit: number;
  },
) {
  const { status, limit } = options;
  const dateFrom = options.dateFrom ?? null;
  const dateTo = options.dateTo ?? null;
  let filtered = history;

  if (status) {
    filtered = filtered.filter((item) => item.status === status);
  }

  if (dateFrom !== null || dateTo !== null) {
    filtered = filtered.filter((item) => {
      const createdAt = Date.parse(item.createdAt);
      if (Number.isNaN(createdAt)) {
        return false;
      }
      if (dateFrom !== null && createdAt < dateFrom) {
        return false;
      }
      if (dateTo !== null && createdAt > dateTo) {
        return false;
      }
      return true;
    });
  }

  if (filtered.length > limit) {
    filtered = filtered.slice(0, limit);
  }

  return filtered;
}

type HistorySummary = {
  totalRuns: number;
  successRuns: number;
  failedRuns: number;
  successRate: number;
  failedRate: number;
  totalPosts: number;
  totalScheduled: number;
  latestRunAt: string | null;
  latestFailedRunAt: string | null;
};

function buildHistorySummary(
  history: Array<{ status: string; createdAt: string; postsCount: number; scheduledCount: number }>,
): HistorySummary {
  let successRuns = 0;
  let failedRuns = 0;
  let totalPosts = 0;
  let totalScheduled = 0;
  let latestRunAt: string | null = null;
  let latestFailedRunAt: string | null = null;
  let latestRunTime = -Infinity;
  let latestFailedTime = -Infinity;

  for (const item of history) {
    if (item.status === "SUCCESS") {
      successRuns += 1;
    } else if (item.status === "FAILED") {
      failedRuns += 1;
    }

    totalPosts += Number.isFinite(item.postsCount) ? item.postsCount : 0;
    totalScheduled += Number.isFinite(item.scheduledCount) ? item.scheduledCount : 0;

    const createdAt = Date.parse(item.createdAt);
    if (!Number.isNaN(createdAt)) {
      if (createdAt > latestRunTime) {
        latestRunTime = createdAt;
        latestRunAt = item.createdAt;
      }
      if (item.status === "FAILED" && createdAt > latestFailedTime) {
        latestFailedTime = createdAt;
        latestFailedRunAt = item.createdAt;
      }
    }
  }

  const totalRuns = history.length;

  return {
    totalRuns,
    successRuns,
    failedRuns,
    successRate: totalRuns ? successRuns / totalRuns : 0,
    failedRate: totalRuns ? failedRuns / totalRuns : 0,
    totalPosts,
    totalScheduled,
    latestRunAt,
    latestFailedRunAt,
  };
}

export async function GET(request: Request) {
  try {
    await requireOwnerAccess(request);
    const status = await getCampoBaseSocialAutomationStatus();
    const url = new URL(request.url);
    const tenantId = url.searchParams.get("tenantId")?.trim() ?? "";
    const saasId = url.searchParams.get("saasId")?.trim() ?? "";
    const automationKeyParam = url.searchParams.get("automationKey")?.trim() ?? "";
    const limitParam = url.searchParams.get("limit");
    const statusFilter = parseStatusFilter(url.searchParams.get("status"));
    const dateFromFilter = parseDateFilter(url.searchParams.get("dateFrom"));
    const dateToFilter = parseDateFilter(url.searchParams.get("dateTo"), true);
    const parsedLimit = limitParam ? Number.parseInt(limitParam, 10) : Number.NaN;
    let limit = Number.isFinite(parsedLimit) && parsedLimit > 0 ? parsedLimit : 25;
    if (limit > 100) {
      limit = 100;
    }
    const history = tenantId && saasId
      ? await listCampoBaseSocialAutomationRunsForSaas(
          tenantId,
          saasId,
          limit,
          automationKeyParam ? automationKeyParam as SocialFlowAutomationKey : undefined,
        )
      : await listCampoBaseSocialAutomationRuns(
          limit,
          automationKeyParam ? automationKeyParam as SocialFlowAutomationKey : undefined,
        );
    const filteredHistory = filterHistory(history, {
      status: statusFilter,
      dateFrom: dateFromFilter,
      dateTo: dateToFilter,
      limit,
    });
    const summary = buildHistorySummary(filteredHistory);
    const observability = tenantId && saasId
      ? await getCampoBaseSocialFlowObservability(tenantId, saasId)
      : null;
    // Nivel 3 — sin gate de tenantId/saasId: es un piloto de un único tenant interno,
    // el filtro vive server-side en el endpoint interno, no depende de query params.
    const { triggers: trendTriggers, health: trendTriggerHealth } = await getCampoBaseSocialFlowTrendTriggers();
    const agentControlCenter = await getCampoBaseAgentControlCenter();
    return NextResponse.json({ status, history: filteredHistory, summary, observability, trendTriggers, trendTriggerHealth, agentControlCenter });
  } catch (error) {
    if (error instanceof UnauthorizedError) {
      return NextResponse.json({ code: "UNAUTHORIZED", message: error.message }, { status: error.status });
    }

    const resolved = resolveActionError(error);
    console.error("CAMPOBASE_SOCIALFLOW_GET_ERROR", error);
    return NextResponse.json(resolved, { status: resolved.status });
  }
}

export async function POST(request: Request) {
  try {
    await requireOwnerAccess(request);
    const action = validateAction(await request.json().catch(() => null));

    if (!action) {
      return NextResponse.json(
        { code: "CAMPOBASE_SOCIALFLOW_INVALID_ACTION", message: "Invalid action payload" },
        { status: 400 },
      );
    }

    if (action.action === "run_all") {
      const result = await runCampoBaseSocialAutomationForAllRegisteredSaas();
      const status = await getCampoBaseSocialAutomationStatus();
      return NextResponse.json({
        action: action.action,
        result,
        status,
      });
    }

    if (action.action === "run_one") {
      const result = action.automationKey === "socialflow.health_check"
        ? await runCampoBaseSocialHealthCheckForRegisteredSaas(action.tenantId, action.saasId)
        : await runCampoBaseSocialAutomationForRegisteredSaas(action.tenantId, action.saasId, action.automationKey);
      const status = await getCampoBaseSocialAutomationStatus();
      return NextResponse.json({
        action: action.action,
        result,
        status,
      });
    }

    if (action.action === "register") {
      const result = await registerCampoBaseSocialAutomation({
        tenantId: action.tenantId,
        saasId: action.saasId,
        niche: action.niche,
        tone: action.tone,
        frequencyPerWeek: action.frequencyPerWeek,
        enabled: action.enabled,
      });
      const status = await getCampoBaseSocialAutomationStatus();
      return NextResponse.json({
        action: action.action,
        result,
        status,
      });
    }

    if (action.action === "register_health") {
      const result = await registerCampoBaseSocialHealthCheck({
        tenantId: action.tenantId,
        saasId: action.saasId,
        tone: action.tone,
        enabled: action.enabled,
      });
      const status = await getCampoBaseSocialAutomationStatus();
      return NextResponse.json({
        action: action.action,
        result,
        status,
      });
    }

    if (action.action === "refresh_observability") {
      const [status, observability] = await Promise.all([
        getCampoBaseSocialAutomationStatus(),
        getCampoBaseSocialFlowObservability(action.tenantId, action.saasId),
      ]);

      return NextResponse.json({
        action: action.action,
        result: { refreshed: true, tenantId: action.tenantId, saasId: action.saasId },
        status,
        observability,
      });
    }

    if (action.action === "linkedin_health_check") {
      const result = await runCampoBaseSocialHealthCheckForRegisteredSaas(action.tenantId, action.saasId);
      const [status, observability] = await Promise.all([
        getCampoBaseSocialAutomationStatus(),
        getCampoBaseSocialFlowObservability(action.tenantId, action.saasId),
      ]);

      return NextResponse.json({
        action: action.action,
        result,
        status,
        observability,
      });
    }

    if (action.action === "test_ai_reply") {
      if (!action.message.trim()) {
        return NextResponse.json(
          { code: "CAMPOBASE_SOCIALFLOW_INVALID_ACTION", message: "message is required" },
          { status: 400 },
        );
      }

      // Probador de respuestas IA — movido aquí desde el CRM Social del cliente (era
      // una herramienta de diagnóstico interna, no algo que el cliente final deba ver).
      // Llama directamente a las funciones del motor conversacional del producto
      // (detectBlockedIntent, generateConversationalReply) — NUNCA a través de un
      // endpoint HTTP de producto final, con el tenant elegido por el operador en vez
      // del tenant de la sesión.
      if (detectBlockedIntent(action.message)) {
        return NextResponse.json({
          action: action.action,
          result: {
            kind: "BLOCKED_INTENT" as const,
            suggestedReply: BLOCKED_INTENT_REPLY,
          },
        });
      }

      const [knowledge, knowledgeContext] = await Promise.all([
        getChannelKnowledge(action.tenantId, action.saasId),
        getKnowledgeContext(action.tenantId, action.saasId).catch(() => ""),
      ]);
      // El nicho del selector es editable a propósito (ver UI): permite probar cómo
      // respondería la IA si este tenant tuviera otro nicho, sin tocar su perfil real
      // — solo se usa para esta llamada, nunca se persiste.
      const profile = action.niche ? { ...knowledge.profile, niche: action.niche } : knowledge.profile;

      const { suggestedReply, aiMetadata } = await generateConversationalReply({
        incomingMessage: action.message,
        threadType: action.threadType,
        profile,
        knowledge,
        knowledgeContext,
        tenantId: action.tenantId,
        saasId: action.saasId,
      });

      return NextResponse.json({
        action: action.action,
        result: {
          kind: "AI_GENERATED" as const,
          suggestedReply,
          aiMetadata,
        },
      });
    }

    if (action.action === "recover_stale_publishing" || action.action === "retry_failed_posts") {
      const result = await runCampoBaseSocialFlowOperatorAction({
        action: action.action,
        tenantId: action.tenantId,
        saasId: action.saasId,
      });
      const [status, observability] = await Promise.all([
        getCampoBaseSocialAutomationStatus(),
        getCampoBaseSocialFlowObservability(action.tenantId, action.saasId),
      ]);

      return NextResponse.json({
        action: action.action,
        result,
        status,
        observability,
      });
    }

    if (action.action === "enable" || action.action === "disable") {
      const result = action.action === "enable"
        ? await enableCampoBaseSocialAutomationForSaas(action.tenantId, action.saasId, action.automationKey)
        : await disableCampoBaseSocialAutomationForSaas(action.tenantId, action.saasId, action.automationKey);

      const status = await getCampoBaseSocialAutomationStatus();

      return NextResponse.json({
        action: action.action,
        result,
        status,
      });
    }

    return NextResponse.json(
      { code: "CAMPOBASE_SOCIALFLOW_INVALID_ACTION", message: "Invalid action payload" },
      { status: 400 },
    );
  } catch (error) {
    if (error instanceof UnauthorizedError) {
      return NextResponse.json({ code: "UNAUTHORIZED", message: error.message }, { status: error.status });
    }

    const resolved = resolveActionError(error);
    console.error("CAMPOBASE_SOCIALFLOW_POST_ERROR", error);
    return NextResponse.json(resolved, { status: resolved.status });
  }
}
