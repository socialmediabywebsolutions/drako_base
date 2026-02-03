import { NextResponse } from "next/server";
import { enforcePublicEndpointPolicy } from "@/lib/security/public-endpoints";
import { resolveHostToSaas } from "@/lib/empire/host-resolver";
import { resolveEffectiveHost } from "@/lib/hosts";
import {
  ensureDatabase,
  DatabaseUnavailableError,
  getRequestBindings,
} from "@/lib/db";
import { DEMO_TENANT_ID } from "@/lib/tenants/services";
import type { NextRequest } from "next/server";
import { getPagesBuildStamp } from "@/lib/pages/build-stamp";

// export const runtime = "edge"; // OpenNext handles the runtime

export async function GET(request: Request) {
  const blocked = await enforcePublicEndpointPolicy({ request, route: "/api/health" });
  if (blocked) return blocked;

  const correlationId = globalThis.crypto?.randomUUID?.() ?? `health_${Date.now()}`;
  const noStoreHeaders = { headers: { "Cache-Control": "no-store" } };

  let buildStamp: unknown;
  const dbPing = { ok: false, error: null as string | null };

  try {
    const bindings = getRequestBindings();
    buildStamp = getPagesBuildStamp(request, correlationId, bindings);

    try {
      // Strict dbPing
      const db = ensureDatabase();
      if (!db) {
        dbPing.error = "Database unavailable";
      } else {
        await db.prepare("SELECT 1").run();
        dbPing.ok = true;
      }
    } catch (error) {
      dbPing.error = error instanceof Error ? error.message : String(error);
    }

    if (!dbPing.ok) {
      const dbStatus = dbPing.error?.includes("DatabaseUnavailableError") ? "missing_binding" : "unknown";
      return NextResponse.json(
        {
          ok: false,
          name: "DRAKO",
          reason: "database_unavailable",
          hint: dbPing.error,
          db: { status: dbStatus, reason: dbPing.error },
          dbPing,
          correlationId,
          tenantFallback: DEMO_TENANT_ID,
          statusUrl: "/api/status.json",
        },
        { status: 503, ...noStoreHeaders },
      );
    }

  } catch (error) {
    // This catch block now primarily handles errors from getRequestBindings or getPagesBuildStamp
    // If dbPing.ok is false here, it means the database check failed and was handled above.
    // If an error occurs before the db check, it's a different kind of failure.
    const errorMessage = error instanceof Error ? error.message : String(error);
    const dbStatus = error instanceof DatabaseUnavailableError ? "missing_binding" : "unknown"; // This might still be relevant if ensureDatabase itself throws before the null check
    return NextResponse.json(
      {
        ok: false,
        name: "DRAKO",
        hint: dbPing.error,
        db: { status: dbStatus, reason: dbPing.error },
        dbPing,
        correlationId,
        tenantFallback: DEMO_TENANT_ID,
        statusUrl: "/api/status.json",
      },
      { status: 503, ...noStoreHeaders },
    );
  }

  const hostHeader = request.headers.get("host") ?? "";
  const url = new URL(request.url);
  let effectiveHost = hostHeader;
  let realHost = hostHeader;
  const possibleReq = request as unknown as NextRequest;
  if (possibleReq?.nextUrl) {
    const hostInfo = resolveEffectiveHost(possibleReq);
    effectiveHost = hostInfo.effectiveHost;
    realHost = hostInfo.realHost;
  }

  const resolution = await resolveHostToSaas(effectiveHost);

  return NextResponse.json(
    {
      ok: true,
      name: "DRAKO",
      time: new Date().toISOString(),
      host: { header: hostHeader, effective: effectiveHost, real: realHost, url: url.hostname },
      resolution,
      db: { status: "ok" },
      dbPing,
      build: buildStamp,
      tenantFallback: DEMO_TENANT_ID,
      correlationId,
      statusUrl: "/api/status.json",
    },
    noStoreHeaders,
  );
}
