export const dynamic = "force-dynamic";

import { NextResponse } from "next/server";
import { requireCurrentSocialFlowSession } from "@/lib/socialflow/auth/request";
import { env } from "@/lib/cf";
import type { BriefingResult } from "@/lib/socialflow/intelligence/WeeklyBriefingAgent";

type BriefingRow = {
  id: string;
  briefing_json: string;
  sent_via: string;
  sent_at: string;
  week_number: number;
  year: number;
};

export async function GET(request: Request) {
  try {
    const session = await requireCurrentSocialFlowSession(request);
    const url = new URL(request.url);
    const saasId = url.searchParams.get("saasId")?.trim() || "socialflow";

    const dracoEnv = env();
    if (!dracoEnv?.SOCIAL_DB) {
      return NextResponse.json({ ok: true, briefings: [] });
    }

    const rows = await dracoEnv.SOCIAL_DB
      .prepare(
        `SELECT id, briefing_json, sent_via, sent_at, week_number, year
         FROM socialcors_briefing_history
         WHERE tenant_id = ? AND saas_id = ?
         ORDER BY sent_at DESC
         LIMIT 12`,
      )
      .bind(session.tenantId, saasId)
      .all<BriefingRow>();

    const briefings = (rows.results ?? []).map((row) => {
      let briefing: BriefingResult | null = null;
      try { briefing = JSON.parse(row.briefing_json) as BriefingResult; } catch { /* skip */ }
      return {
        id: row.id,
        sentAt: row.sent_at,
        weekNumber: row.week_number,
        year: row.year,
        sentVia: row.sent_via ? row.sent_via.split(",") : [],
        briefing,
      };
    }).filter((b) => b.briefing !== null);

    return NextResponse.json({ ok: true, briefings });
  } catch (error) {
    if (error instanceof Error && error.message === "SESSION_REQUIRED") {
      return NextResponse.json({ error: "SESSION_REQUIRED" }, { status: 401 });
    }
    console.error("SOCIALFLOW_BRIEFINGS_GET_ERROR", error instanceof Error ? error.message : "unknown");
    return NextResponse.json({ error: "BRIEFINGS_LIST_FAILED" }, { status: 500 });
  }
}
