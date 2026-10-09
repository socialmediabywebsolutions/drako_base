export const dynamic = "force-dynamic";

import { NextResponse } from "next/server";
import { requireCurrentSocialFlowSession } from "@/lib/socialflow/auth/request";
import {
  getChannelKnowledge,
  listChannelCompetitors,
  upsertChannelCompetitor,
  upsertChannelProfile,
} from "@/lib/socialflow/profile/repository";
import { SocialContextError } from "@/lib/socialflow/repository";
import { analyzeCompetitorForKnowledgeBase, buildCompetitorSourceUrl } from "@/lib/socialflow/knowledge/competitor-analysis";
import { getCloudflareContextSafeAsync } from "@/lib/cloudflare/runtime";

const DEFAULT_SAAS_ID = "socialflow";

type ProfileRequestBody = {
  tenantId?: string | null;
  saasId?: string | null;
  profile?: unknown;
  competitor?: unknown;
};

function resolveSaasId(request: Request, body?: ProfileRequestBody | null): string {
  const requestUrl = new URL(request.url);
  const querySaasId = requestUrl.searchParams.get("saasId")?.trim();
  const bodySaasId = body?.saasId?.trim();
  return querySaasId || bodySaasId || DEFAULT_SAAS_ID;
}

function isTenantMismatch(sessionTenantId: string, request: Request, body?: ProfileRequestBody | null): boolean {
  const requestUrl = new URL(request.url);
  const queryTenantId = requestUrl.searchParams.get("tenantId")?.trim();
  const bodyTenantId = body?.tenantId?.trim();
  const requested = queryTenantId || bodyTenantId;
  if (!requested) return false;
  return requested !== sessionTenantId;
}

function asRecord(value: unknown): Record<string, unknown> | null {
  if (!value || typeof value !== "object" || Array.isArray(value)) return null;
  return value as Record<string, unknown>;
}

// Runs `work` after the response is sent when a real Workers ExecutionContext is
// available (ctx.waitUntil keeps the isolate alive without the client waiting on
// it); falls back to awaiting inline in environments without one (local dev),
// so the analysis still runs there instead of silently being dropped.
async function runInBackground(work: Promise<unknown>): Promise<void> {
  const settled = work.catch((err) => {
    console.error("SOCIALFLOW_PROFILE_BACKGROUND_TASK_FAILED", err instanceof Error ? err.message : String(err));
  });
  const cfContext = (await getCloudflareContextSafeAsync()) as { ctx?: { waitUntil?: (p: Promise<unknown>) => void } } | null;
  if (cfContext?.ctx?.waitUntil) {
    cfContext.ctx.waitUntil(settled);
    return;
  }
  await settled;
}

// Al guardar el perfil del canal, si ya hay competidores configurados (Mi Perfil
// → Competidores), relanza el análisis de cada uno en background — así el
// Cerebro se mantiene al día sin que el usuario tenga que volver a pulsar
// "Analizar competidora" manualmente cada vez. dedupe:true actualiza el doc
// existente de cada competidor en vez de acumular uno nuevo en cada guardado.
async function triggerCompetitorAnalysisForProfileSave(tenantId: string, saasId: string): Promise<void> {
  const competitors = await listChannelCompetitors(tenantId, saasId);
  if (competitors.length === 0) return;

  await Promise.allSettled(
    competitors.map((competitor) =>
      analyzeCompetitorForKnowledgeBase({
        tenantId,
        saasId,
        name: competitor.name,
        url: buildCompetitorSourceUrl(competitor),
        dedupe: true,
      }),
    ),
  );
}

export async function GET(request: Request) {
  try {
    const session = await requireCurrentSocialFlowSession(request);
    if (isTenantMismatch(session.tenantId, request)) {
      return NextResponse.json({ ok: false, error: "FORBIDDEN_TENANT_SCOPE" }, { status: 403 });
    }

    const saasId = resolveSaasId(request);
    const snapshot = await getChannelKnowledge(session.tenantId, saasId);
    return NextResponse.json({ ok: true, profile: snapshot.profile, competitors: snapshot.competitors, assets: snapshot.assets });
  } catch (error) {
    if (error instanceof SocialContextError) {
      return NextResponse.json({ ok: false, error: "INVALID_SOCIAL_CONTEXT", message: error.message }, { status: 400 });
    }
    if (error instanceof Error && error.message === "SESSION_REQUIRED") {
      return NextResponse.json({ ok: false, error: "SESSION_REQUIRED" }, { status: 401 });
    }
    console.error("SOCIALFLOW_PROFILE_GET_ERROR", error);
    return NextResponse.json({ ok: false, error: "Failed to load profile" }, { status: 500 });
  }
}

export async function POST(request: Request) {
  try {
    const session = await requireCurrentSocialFlowSession(request);
    const body = (await request.json().catch(() => null)) as ProfileRequestBody | null;
    if (!body) {
      return NextResponse.json({ ok: false, error: "Invalid body" }, { status: 400 });
    }
    if (isTenantMismatch(session.tenantId, request, body)) {
      return NextResponse.json({ ok: false, error: "FORBIDDEN_TENANT_SCOPE" }, { status: 403 });
    }

    const saasId = resolveSaasId(request, body);

    if (body.profile) {
      const profilePatch = asRecord(body.profile);
      if (!profilePatch) {
        return NextResponse.json({ ok: false, error: "Invalid profile payload" }, { status: 400 });
      }
      const updated = await upsertChannelProfile(session.tenantId, profilePatch, saasId);
      void runInBackground(triggerCompetitorAnalysisForProfileSave(session.tenantId, saasId));
      return NextResponse.json({ ok: true, profile: updated });
    }
    if (body.competitor) {
      const competitorPatch = asRecord(body.competitor);
      if (!competitorPatch) {
        return NextResponse.json({ ok: false, error: "Invalid competitor payload" }, { status: 400 });
      }
      const competitor = await upsertChannelCompetitor(session.tenantId, competitorPatch, saasId);
      return NextResponse.json({ ok: true, competitor });
    }
    return NextResponse.json({ ok: false, error: "Nothing to update" }, { status: 400 });
  } catch (error) {
    if (error instanceof SocialContextError) {
      return NextResponse.json({ ok: false, error: "INVALID_SOCIAL_CONTEXT", message: error.message }, { status: 400 });
    }
    if (error instanceof Error && error.message === "SESSION_REQUIRED") {
      return NextResponse.json({ ok: false, error: "SESSION_REQUIRED" }, { status: 401 });
    }
    console.error("SOCIALFLOW_PROFILE_POST_ERROR", error);
    return NextResponse.json({ ok: false, error: "Failed to update profile" }, { status: 500 });
  }
}

export async function PATCH(request: Request) {
  return POST(request);
}
