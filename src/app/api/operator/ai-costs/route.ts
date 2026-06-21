export const dynamic = "force-dynamic";

import { NextResponse } from "next/server";
import { queryAll } from "@/lib/db";
import { requireOwnerAccess, UnauthorizedError } from "@/lib/auth/session";

export async function GET(req: Request) {
  try {
    await requireOwnerAccess(req);

    const url = new URL(req.url);
    const tenantId = url.searchParams.get("tenantId")?.trim() || "";
    const saasId = url.searchParams.get("saasId")?.trim() || "";

    let sql: string;
    let params: string[];

    if (tenantId && saasId) {
      sql = `SELECT key, tokens_in, tokens_out, requests_count, saas_id, model, updated_at
             FROM ai_usage_counters
             WHERE key LIKE ? AND saas_id = ?
             ORDER BY updated_at DESC`;
      params = [`${tenantId}:%`, saasId];
    } else if (tenantId) {
      sql = `SELECT key, tokens_in, tokens_out, requests_count, saas_id, model, updated_at
             FROM ai_usage_counters
             WHERE key LIKE ?
             ORDER BY updated_at DESC`;
      params = [`${tenantId}:%`];
    } else {
      sql = `SELECT key, tokens_in, tokens_out, requests_count, saas_id, model, updated_at
             FROM ai_usage_counters
             ORDER BY updated_at DESC
             LIMIT 500`;
      params = [];
    }

    const rows = await queryAll(sql, ...params) as Array<{
      key: string;
      tokens_in: number;
      tokens_out: number;
      requests_count: number;
      saas_id: string;
      model: string;
      updated_at: string;
    }>;

    // Parse month from key: format is tenantId:saasId:model:YYYY-M or legacy tenantId:YYYY-M
    const entries = rows.map((row) => {
      const parts = row.key.split(":");
      const month = parts[parts.length - 1] ?? "";
      const parsedTenantId = parts[0] ?? "";
      return {
        key: row.key,
        tenantId: parsedTenantId,
        saasId: row.saas_id || (parts.length === 2 ? "" : parts[1]) || "",
        model: row.model || "",
        month,
        tokensIn: row.tokens_in,
        tokensOut: row.tokens_out,
        requestsCount: row.requests_count,
        updatedAt: row.updated_at,
      };
    });

    return NextResponse.json({ ok: true, count: entries.length, entries });
  } catch (error) {
    if (error instanceof UnauthorizedError) {
      return NextResponse.json({ ok: false, error: "UNAUTHORIZED" }, { status: 401 });
    }
    console.error("OPERATOR_AI_COSTS_ERROR", error);
    return NextResponse.json({ ok: false, error: "AI_COSTS_FAILED" }, { status: 500 });
  }
}
