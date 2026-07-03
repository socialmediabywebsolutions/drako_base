import { resolveAuthsDbForContext } from "@/lib/auths/repositories";

// Deliberately free of "next/headers" (unlike auth/server.ts / auth/request.ts): this is
// imported by live-publishing.ts, which is also bundled directly into the standalone
// socialflow-ai-worker (plain esbuild via wrangler, no Next.js/OpenNext runtime). Pulling
// in next/headers there breaks that worker's build (ua-parser-js needs __dirname, which
// only Next's own bundling provides a shim for).
export async function getSocialFlowAccountTypeByTenant(tenantId: string): Promise<"influencer" | "empresa" | null> {
  const db = resolveAuthsDbForContext("socialflow");
  if (!db) return null;
  const row = await db
    .prepare(`SELECT account_type FROM socialflow_users WHERE tenant_id = ? LIMIT 1`)
    .bind(tenantId)
    .first<{ account_type: string | null }>();
  return row?.account_type === "influencer" || row?.account_type === "empresa" ? row.account_type : null;
}
