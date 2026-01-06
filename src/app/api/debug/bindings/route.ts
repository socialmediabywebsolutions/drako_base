import { NextResponse } from "next/server";
import { env } from "@/lib/cf";
import { getDracoDbFromRequestContext } from "@/lib/db";


export async function GET(request: Request) {
  const correlationId = globalThis.crypto?.randomUUID?.() ?? `debug_${Date.now()}`;
  const noStoreHeaders = { headers: { "Cache-Control": "no-store" } };
  const bindings = env() as Record<string, string | undefined> | null;
  const envKeys = bindings ? Object.keys(bindings).sort() : [];
  const pagesBranch = bindings?.CF_PAGES_BRANCH ?? process.env.CF_PAGES_BRANCH ?? null;
  const pagesCommitSha = bindings?.CF_PAGES_COMMIT_SHA ?? process.env.CF_PAGES_COMMIT_SHA ?? null;
  const pagesUrl = bindings?.CF_PAGES_URL ?? process.env.CF_PAGES_URL ?? null;
  const isPages =
    typeof (globalThis as typeof globalThis & { caches?: unknown }).caches !== "undefined" &&
    typeof (globalThis as typeof globalThis & { WebSocketPair?: unknown }).WebSocketPair !==
      "undefined";

  const debugToken =
    (bindings as Record<string, string | undefined> | null)?.DEBUG_TOKEN ??
    process.env.DEBUG_TOKEN ??
    null;
  const tokenHeader = request.headers.get("x-debug-token");
  const tokenQuery = new URL(request.url).searchParams.get("token");

  const isPreviewBranch = Boolean(pagesBranch && pagesBranch !== "main");
  const isDevMode = (process.env.NODE_ENV ?? "production") !== "production";
  const allowWithoutToken = !debugToken && (isPreviewBranch || isDevMode);
  const providedToken = tokenHeader ?? tokenQuery;

  if (debugToken && providedToken !== debugToken) {
    return NextResponse.json(
      {
        ok: false,
        reason: "debug_token_required",
        correlationId,
      },
      { status: 401, ...noStoreHeaders },
    );
  }

  if (!debugToken && !allowWithoutToken) {
    return NextResponse.json(
      {
        ok: false,
        reason: "debug_token_required",
        correlationId,
      },
      { status: 401, ...noStoreHeaders },
    );
  }

  let hasDracoDb = false;
  let dbPing: { ok: boolean; error?: string } | null = null;
  let reason: string | null = null;
  let bindingStatus: "ok" | "no_request_context" | "binding_missing" = "ok";
  if (!bindings) {
    reason =
      "binding_missing_in_runtime: no request context detected (are you calling outside a request or using the wrong runtime?).";
    bindingStatus = "no_request_context";
  } else if (!("DRACO_DB" in bindings)) {
    reason =
      "binding_missing_in_runtime: DRACO_DB not present (check Pages bindings, project, or branch).";
    bindingStatus = "binding_missing";
  }

  if (!reason) {
    try {
      const db = getDracoDbFromRequestContext();
      hasDracoDb = true;
      try {
        const result = await db.prepare("SELECT 1 as ok").first<{ ok: number }>();
        dbPing = { ok: result?.ok === 1 };
      } catch (error) {
        const message = error instanceof Error ? error.message : String(error);
        dbPing = { ok: false, error: message };
      }
    } catch (error) {
      const message = error instanceof Error ? error.message : String(error);
      reason = `binding_missing_in_runtime: ${message}`;
      bindingStatus = message.toLowerCase().includes("request context")
        ? "no_request_context"
        : "binding_missing";
    }
  }

  return NextResponse.json({
    ok: bindingStatus === "ok",
    correlationId,
    request: {
      host: request.headers.get("host") ?? "",
      url: request.url,
    },
    pages: {
      branch: pagesBranch,
      commitSha: pagesCommitSha,
      url: pagesUrl,
    },
    isPages,
    hasRequestContext: Boolean(bindings),
    hasDracoDb,
    envKeys,
    dbPing,
    reason,
    bindingStatus,
  }, noStoreHeaders);
}
