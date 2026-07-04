export const dynamic = "force-dynamic";

import { NextRequest, NextResponse } from "next/server";
import { CronAuthError, verifyCronAuth } from "@/lib/security/cron-auth";
import { env } from "@/lib/cf";
import { StyleLearningAgent } from "@/lib/socialflow/ai/agents/StyleLearningAgent";

const MIN_PUBLISHED_POSTS = 10;

type TenantRow = { tenant_id: string; saas_id: string; published_count: number };

type TenantResult = {
  tenantId: string;
  saasId: string;
  ok: boolean;
  postsAnalyzed?: number;
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

  const bindings = env();
  const socialDb = bindings?.SOCIAL_DB;
  if (!socialDb) {
    return NextResponse.json({ ok: false, code: "SOCIAL_DB_UNAVAILABLE" }, { status: 503 });
  }

  // Every tenant/saas pair with at least MIN_PUBLISHED_POSTS published posts.
  let tenantRows: TenantRow[];
  try {
    const result = await socialDb
      .prepare(
        `SELECT tenant_id, saas_id, COUNT(*) as published_count
         FROM saas_social_posts
         WHERE status IN ('POSTED', 'PUBLISHED')
         GROUP BY tenant_id, saas_id
         HAVING COUNT(*) >= ?`,
      )
      .bind(MIN_PUBLISHED_POSTS)
      .all<TenantRow>();
    tenantRows = result.results ?? [];
  } catch (err) {
    console.error("[cron/style-learning] tenant query failed", err instanceof Error ? err.message : String(err));
    return NextResponse.json({ ok: false, code: "DB_QUERY_FAILED" }, { status: 500 });
  }

  if (!tenantRows.length) {
    return NextResponse.json({ ok: true, message: "No tenants with enough published posts yet", results: [] });
  }

  const results: TenantResult[] = [];

  for (const row of tenantRows) {
    try {
      const learned = await new StyleLearningAgent().run({ tenantId: row.tenant_id, saasId: row.saas_id });
      results.push({
        tenantId: row.tenant_id,
        saasId: row.saas_id,
        ok: true,
        postsAnalyzed: learned?.postsAnalyzed ?? 0,
      });
    } catch (err) {
      console.error("[cron/style-learning] agent failed", row.tenant_id, err instanceof Error ? err.message : String(err));
      results.push({
        tenantId: row.tenant_id,
        saasId: row.saas_id,
        ok: false,
        error: err instanceof Error ? err.message : String(err),
      });
    }
  }

  return NextResponse.json({ ok: true, tenantsProcessed: results.length, results });
}
