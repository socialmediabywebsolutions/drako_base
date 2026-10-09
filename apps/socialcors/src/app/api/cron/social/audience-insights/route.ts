export const dynamic = "force-dynamic";

import { NextRequest, NextResponse } from "next/server";
import { CronAuthError, verifyCronAuth } from "@/lib/security/cron-auth";
import { guardCronTurn } from "@/lib/security/cron-lock";
import { env } from "@/lib/cf";
import { AudienceInsightAgent } from "@/lib/socialflow/ai/agents/AudienceInsightAgent";
import { withAgentExecutionLog } from "@/lib/socialflow/intelligence/agent-execution-log";

const MIN_COMMENTS = 10;

type TenantRow = { tenant_id: string; saas_id: string; comment_count: number };

type TenantResult = {
  tenantId: string;
  saasId: string;
  ok: boolean;
  insightsGenerated?: number;
  error?: string;
};

export async function GET(request: NextRequest) {
  try {
    verifyCronAuth(request);
  } catch (error) {
    if (error instanceof CronAuthError) {
      return NextResponse.json({ error: error.message }, { status: error.status });
    }
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const locked = await guardCronTurn(request, "audience-insights", 1440);
  if (locked) return locked;

  const bindings = env();
  const socialDb = bindings?.SOCIAL_DB;
  if (!socialDb) {
    return NextResponse.json({ ok: false, code: "SOCIAL_DB_UNAVAILABLE" }, { status: 503 });
  }

  // Every tenant/saas pair with at least MIN_COMMENTS comments (no DMs) recibidos.
  let tenantRows: TenantRow[];
  try {
    const result = await socialDb
      .prepare(
        `SELECT tenant_id, saas_id, COUNT(*) as comment_count
         FROM socialflow_conversation_threads
         WHERE thread_type = 'COMMENT'
         GROUP BY tenant_id, saas_id
         HAVING COUNT(*) >= ?`,
      )
      .bind(MIN_COMMENTS)
      .all<TenantRow>();
    tenantRows = result.results ?? [];
  } catch (err) {
    console.error("[cron/audience-insights] tenant query failed", err instanceof Error ? err.message : String(err));
    return NextResponse.json({ ok: false, code: "DB_QUERY_FAILED" }, { status: 500 });
  }

  if (!tenantRows.length) {
    return NextResponse.json({ ok: true, message: "No tenants with enough comments yet", results: [] });
  }

  const results: TenantResult[] = [];

  for (const row of tenantRows) {
    try {
      const insights = await withAgentExecutionLog({
        db: socialDb,
        agentName: "AudienceInsightAgent",
        tenantId: row.tenant_id,
        saasId: row.saas_id,
        run: () => new AudienceInsightAgent().run({ tenantId: row.tenant_id, saasId: row.saas_id }),
        rowsWritten: (r) => r?.length ?? 0,
      });
      results.push({
        tenantId: row.tenant_id,
        saasId: row.saas_id,
        ok: true,
        insightsGenerated: insights?.length ?? 0,
      });
    } catch (err) {
      console.error("[cron/audience-insights] agent failed", row.tenant_id, err instanceof Error ? err.message : String(err));
      results.push({
        tenantId: row.tenant_id,
        saasId: row.saas_id,
        ok: false,
        error: err instanceof Error ? err.message : String(err),
      });
    }
  }

  const processed = results.filter((r) => r.ok).length;

  return NextResponse.json({ ok: true, tenantsProcessed: results.length, processed, results });
}
