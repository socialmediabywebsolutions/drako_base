export const dynamic = "force-dynamic";

import { NextRequest, NextResponse } from "next/server";
import { CronAuthError, verifyCronAuth } from "@/lib/socialflow/platform/cron/auth";
import { env } from "@/lib/cf";
import { fetchInstagramMediaSince, MetaIntegrationError } from "@/lib/socialflow/meta/core";
import { importInstagramMediaItems, resolveInstagramCredentials, type InstagramImportAccount } from "@/lib/socialflow/meta/instagram-import";
import { withAgentExecutionLog } from "@/lib/socialflow/intelligence/agent-execution-log";

const HISTORY_MONTHS = 6;

type AccountImportResult = {
  accountId: string;
  tenantId: string;
  ok: boolean;
  fetched: number;
  imported: number;
  skippedRecent: number;
  error?: string;
};

// Importa a saas_social_posts (creation_mode IMPORTED) el histórico de los últimos 6
// meses de cada cuenta de Instagram CONNECTED_REAL, para que los agentes del Cerebro
// tengan posts de los clientes que publican directamente en Instagram. Idempotente:
// el índice único (tenant_id, external_post_id) salta lo que ya existe. El recolector de
// métricas mantiene después los nuevos posts al día cada 4 h. Solo con CRON_SECRET.
export async function POST(request: NextRequest) {
  try {
    verifyCronAuth(request);
  } catch (error) {
    if (error instanceof CronAuthError) {
      return NextResponse.json({ error: error.message }, { status: error.status });
    }
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const db = env()?.SOCIAL_DB;
  if (!db) {
    return NextResponse.json({ ok: false, code: "SOCIAL_DB_UNAVAILABLE" }, { status: 503 });
  }

  const since = new Date();
  since.setUTCMonth(since.getUTCMonth() - HISTORY_MONTHS);
  const sinceIso = since.toISOString();

  const results = await withAgentExecutionLog({
    db,
    agentName: "InstagramHistoryImport",
    tenantId: null,
    saasId: null,
    run: () => importAllAccounts(db, sinceIso),
    rowsWritten: (r) => r.reduce((sum, x) => sum + x.imported, 0),
  });

  return NextResponse.json({
    ok: results.every((r) => r.ok),
    since: sinceIso,
    imported: results.reduce((sum, r) => sum + r.imported, 0),
    results,
  });
}

async function importAllAccounts(db: D1Database, sinceIso: string): Promise<AccountImportResult[]> {
  const { results: accounts } = await db
    .prepare(
      `SELECT id, tenant_id, saas_id, auth_meta FROM saas_social_accounts
       WHERE provider = 'INSTAGRAM' AND status = 'CONNECTED_REAL'`,
    )
    .all<InstagramImportAccount>();

  const results: AccountImportResult[] = [];
  for (const account of accounts ?? []) {
    const base = { accountId: account.id, tenantId: account.tenant_id };
    try {
      const creds = await resolveInstagramCredentials(account.auth_meta);
      if (!creds) {
        results.push({ ...base, ok: false, fetched: 0, imported: 0, skippedRecent: 0, error: "MISSING_OR_UNDECRYPTABLE_TOKEN" });
        continue;
      }
      const media = await fetchInstagramMediaSince(creds.pageToken, creds.igUserId, creds.apiBase, sinceIso);
      const { imported, skippedRecent } = await importInstagramMediaItems(db, account, media);
      results.push({ ...base, ok: true, fetched: media.length, imported, skippedRecent });
    } catch (err) {
      const message = err instanceof MetaIntegrationError ? `${err.code}: ${err.message}` : err instanceof Error ? err.message : String(err);
      console.error("[InstagramHistoryImport] account failed", account.id, message);
      results.push({ ...base, ok: false, fetched: 0, imported: 0, skippedRecent: 0, error: message });
    }
  }
  return results;
}
