export const dynamic = "force-dynamic";

import { NextRequest, NextResponse } from "next/server";
import { env } from "@/lib/cf";
import { getCurrentSocialFlowSessionFromRequest } from "@/lib/socialflow/auth/request";
import {
  runWeeklyBriefingForTenant,
  runWeeklyBriefingForAllTenants,
  DEFAULT_SAAS_ID,
} from "@/lib/socialflow/intelligence/WeeklyBriefingAgent";

const CORE_TENANT_ID = "socialflow-core";

function constantTimeEqual(a: string, b: string): boolean {
  if (a.length !== b.length) return false;
  let result = 0;
  for (let i = 0; i < a.length; i += 1) {
    result |= a.charCodeAt(i) ^ b.charCodeAt(i);
  }
  return result === 0;
}

async function isAuthorized(request: NextRequest): Promise<boolean> {
  const session = await getCurrentSocialFlowSessionFromRequest(request).catch(() => null);
  if (session?.tenantId === CORE_TENANT_ID) return true;

  const providedKey = request.headers.get("x-admin-key")?.trim();
  const configuredKey = env()?.SOCIALFLOW_ADMIN_KEY?.trim();
  if (!providedKey || !configuredKey) return false;
  return constantTimeEqual(providedKey, configuredKey);
}

// Manual trigger for WeeklyBriefingAgent — same work the Monday 03:00 UTC cron
// does (after niche-intelligence), exposed here to test without waiting a week.
export async function POST(request: NextRequest) {
  if (!(await isAuthorized(request))) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const bindings = env();
  if (!bindings?.SOCIAL_DB) {
    return NextResponse.json({ ok: false, code: "SOCIAL_DB_UNAVAILABLE" }, { status: 503 });
  }

  const body = (await request.json().catch(() => ({}))) as { tenant_id?: unknown; saas_id?: unknown };
  const tenantId = typeof body?.tenant_id === "string" && body.tenant_id.trim() ? body.tenant_id.trim() : null;
  // Not part of the original spec's body shape, but every briefing function keys
  // on (tenantId, saasId) together — defaults to the product's own DEFAULT_SAAS_ID
  // (matches getChannelProfile et al.) when only tenant_id is given.
  const saasId = typeof body?.saas_id === "string" && body.saas_id.trim() ? body.saas_id.trim() : DEFAULT_SAAS_ID;

  const startedAt = Date.now();

  if (tenantId) {
    try {
      await runWeeklyBriefingForTenant(tenantId, saasId, bindings);
    } catch (err) {
      console.error("[admin/weekly-briefing/send] runWeeklyBriefingForTenant failed", tenantId, saasId, err instanceof Error ? err.message : String(err));
      return NextResponse.json(
        { ok: false, code: "BRIEFING_SEND_FAILED", message: err instanceof Error ? err.message : String(err) },
        { status: 500 },
      );
    }
    return NextResponse.json({
      success: true,
      tenants_processed: 1,
      duration_ms: Date.now() - startedAt,
    });
  }

  const results = await runWeeklyBriefingForAllTenants(bindings);
  return NextResponse.json({
    success: true,
    tenants_processed: results.length,
    results,
    duration_ms: Date.now() - startedAt,
  });
}
