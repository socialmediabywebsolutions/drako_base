import { NextResponse } from "next/server";
import { env } from "@/lib/cf";
import { getDracoDbFromRequestContext } from "@/lib/db";

// export const runtime = "edge"; // OpenNext handles the runtime

export async function GET(request: Request) {
  const correlationId = globalThis.crypto?.randomUUID?.() ?? `debug_${Date.now()}`;
  const noStoreHeaders = { headers: { "Cache-Control": "no-store" } };

  let bindings: Record<string, unknown> | null = null;
  try {
    bindings = env() as unknown as Record<string, unknown>;
  } catch {
    bindings = null;
  }

  const envKeys = bindings ? Object.keys(bindings).filter(k => !k.toLowerCase().includes("secret") && !k.toLowerCase().includes("key") && !k.toLowerCase().includes("token")).sort() : [];

  const debugToken = (bindings?.DEBUG_TOKEN as string | undefined) ?? process.env.DEBUG_TOKEN ?? null;
  const tokenHeader = request.headers.get("x-debug-token");
  const tokenQuery = new URL(request.url).searchParams.get("token");
  const providedToken = tokenHeader ?? tokenQuery;

  if (debugToken && providedToken !== debugToken) {
    return NextResponse.json({ ok: false, reason: "debug_token_required", correlationId }, { status: 401, ...noStoreHeaders });
  }

  let hasDracoDb = false;
  let dbPing: { ok: boolean; error?: string } = { ok: false };
  let bindingStatus: "ok" | "no_request_context" | "binding_missing" = "ok";
  let reason: string | null = null;

  if (!bindings) {
    bindingStatus = "no_request_context";
    reason = "No request context detected or env() called outside request scope.";
  } else if (!bindings.DRACO_DB) {
    bindingStatus = "binding_missing";
    reason = "DRACO_DB binding not present in environment.";
  } else {
    try {
      const db = getDracoDbFromRequestContext();
      if (!db) {
        dbPing = { ok: false, error: "Database unavailable" };
      } else {
        hasDracoDb = true;
        const result = await db.prepare("SELECT 1 as ok").first<{ ok: number }>();
        dbPing = { ok: result?.ok === 1 };
      }
    } catch (error) {
      dbPing = { ok: false, error: error instanceof Error ? error.message : String(error) };
    }
    reason = dbPing.error || "DB ping failed";
  }

  return NextResponse.json({
    ok: bindingStatus === "ok" && dbPing.ok,
    correlationId,
    adapter: "OpenNext",
    runtime: "Workers",
    isWorkers: typeof (globalThis as unknown as { WorkerGlobalScope?: unknown }).WorkerGlobalScope !== "undefined" || typeof (globalThis as unknown as { WebSocketPair?: unknown }).WebSocketPair !== "undefined",
    hasRequestContext: Boolean(bindings),
    hasDracoDb,
    envKeys,
    dbPing,
    reason,
    bindingStatus,
    bindingHint: bindingStatus === "binding_missing"
      ? "Check wrangler.toml: Ensure [[d1_databases]] binding = 'DRACO_DB' is present for this environment."
      : null,
  }, noStoreHeaders);
}
