import { NextResponse } from "next/server";
import { enforcePublicEndpointPolicy } from "@/lib/security/public-endpoints";
import { resolveHostToSaas } from "@/lib/empire/host-resolver";
import { resolveEffectiveHost } from "@/lib/hosts";
import { ensureDatabase, queryAll, queryOne, DatabaseUnavailableError } from "@/lib/db";
import { ensureCampamentoBase } from "@/lib/campamento-base";
import { DEMO_TENANT_ID } from "@/lib/tenants/services";
import type { NextRequest } from "next/server";
import { env } from "@/lib/cf";
export const runtime = "edge";


function getPagesStamp(request: Request, correlationId: string) {
  const bindings = env() as Record<string, string | undefined> | null;
  const pagesBranch = bindings?.CF_PAGES_BRANCH ?? process.env.CF_PAGES_BRANCH;
  const pagesCommitSha = bindings?.CF_PAGES_COMMIT_SHA ?? process.env.CF_PAGES_COMMIT_SHA;
  const pagesUrl = bindings?.CF_PAGES_URL ?? process.env.CF_PAGES_URL;
  const pagesBuildId = bindings?.CF_PAGES_BUILD_ID ?? process.env.CF_PAGES_BUILD_ID;
  const provisioningMode =
    bindings?.CLOUDFLARE_PROVISIONING_MODE ?? process.env.CLOUDFLARE_PROVISIONING_MODE ?? null;
  const requestUrl = request.url;
  const requestHost = request.headers.get("host") ?? "";

  return {
    pages: {
      branch: pagesBranch ?? null,
      commitSha: pagesCommitSha ?? null,
      url: pagesUrl ?? null,
      buildId: pagesBuildId ?? null,
    },
    environment: {
      nodeEnv: process.env.NODE_ENV ?? null,
      provisioningMode,
    },
    bindings: {
      dracoDb: Boolean(bindings?.DRACO_DB),
    },
    request: {
      host: requestHost,
      url: requestUrl,
      hostMode: request.headers.get("x-drako-host-mode") ?? null,
    },
    correlationId,
  };
}

export async function GET(request: Request) {
  const blocked = await enforcePublicEndpointPolicy({ request, route: "/api/health" });
  if (blocked) return blocked;

  const correlationId = globalThis.crypto?.randomUUID?.() ?? `health_${Date.now()}`;
  const buildStamp = getPagesStamp(request, correlationId);
  const noStoreHeaders = { headers: { "Cache-Control": "no-store" } };
  let dbStatus: "ok" | "missing_binding" | "schema_error" | "unknown" = "ok";
  let dbReason: string | null = null;
  const missingTables: string[] = [];
  try {
    ensureDatabase();
    const requiredTables = ["saas", "saas_domains", "saas_projects", "owners", "clients"];
    for (const table of requiredTables) {
      try {
        await queryOne(`SELECT name FROM sqlite_master WHERE type='table' AND name = ?`, table);
      } catch {
        missingTables.push(table);
      }
    }
    try {
      await ensureCampamentoBase();
    } catch (seedError) {
      dbStatus = "schema_error";
      dbReason = seedError instanceof Error ? seedError.message : String(seedError);
      return NextResponse.json(
        {
          ok: false,
          name: "DRAKO",
          reason: "seed_failed",
          hint: dbReason,
          db: { status: dbStatus, reason: dbReason },
          correlationId,
          tenantFallback: DEMO_TENANT_ID,
        },
        { status: 503, ...noStoreHeaders },
      );
    }
  } catch (error) {
    if (error instanceof DatabaseUnavailableError) {
      dbStatus = error.reason === "binding-missing" ? "missing_binding" : "schema_error";
      dbReason = error.message;
    } else {
      dbStatus = "unknown";
      dbReason = error instanceof Error ? error.message : String(error);
    }
    const bindingDetails =
      dbStatus === "missing_binding"
        ? {
            bindingName: "DRACO_DB",
            action:
              "Configure D1 binding in Cloudflare Pages: Project -> Settings -> Functions -> D1 bindings.",
          }
        : {};
    return NextResponse.json(
      {
        ok: false,
        name: "DRAKO",
        reason: "database_unavailable",
        hint: dbReason,
        db: { status: dbStatus, reason: dbReason },
        correlationId,
        build: buildStamp,
        ...bindingDetails,
        tenantFallback: DEMO_TENANT_ID,
      },
      { status: 503, ...noStoreHeaders },
    );
  }

  const hostHeader = request.headers.get("host") ?? "";
  const url = new URL(request.url);
  let effectiveHost = hostHeader;
  let realHost = hostHeader;
  const possibleReq = request as unknown as NextRequest;
  if (typeof possibleReq === "object" && "nextUrl" in possibleReq) {
    const hostInfo = resolveEffectiveHost(possibleReq);
    effectiveHost = hostInfo.effectiveHost;
    realHost = hostInfo.realHost;
  }

  const resolution = await resolveHostToSaas(effectiveHost);
  const domains = await queryAll<{ domain: string; saas_id: string; status: string; verification_status: string | null }>(
    "SELECT domain, saas_id, status, verification_status FROM saas_domains WHERE domain IN ('drako.systems','base.drako.systems')"
  );
  const campamento = await queryOne<{ id: string; slug: string; status: string }>(
    "SELECT id, slug, status FROM saas WHERE slug IN ('campamento-base','admin','base') LIMIT 1"
  );
  const publicSaas = await queryOne<{ id: string; slug: string; status: string }>(
    "SELECT id, slug, status FROM saas WHERE slug IN ('drako-systems','drako','public') LIMIT 1"
  );

  const campamentoProject = !campamento
    ? await queryOne<{ id: string; slug: string; status: string }>(
        "SELECT id, slug, status FROM saas_projects WHERE slug IN ('campamento-base','admin','base') LIMIT 1"
      )
    : null;
  const publicSaasProject = !publicSaas
    ? await queryOne<{ id: string; slug: string; status: string }>(
        "SELECT id, slug, status FROM saas_projects WHERE slug IN ('drako-systems','drako','public') LIMIT 1"
      )
    : null;

  const hints: string[] = [];
  if (!campamento && !campamentoProject) hints.push("campamento_missing");
  if (!publicSaas && !publicSaasProject) hints.push("public_saas_missing");
  if (!domains || domains.length === 0) hints.push("domains_missing");
  if (resolution.status === "NOT_FOUND") hints.push("host_resolution_not_found");
  if (resolution.status === "PENDING") hints.push("host_pending_verification");

  return NextResponse.json(
    {
      ok: hints.length === 0,
      name: "DRAKO",
      time: new Date().toISOString(),
      host: { header: hostHeader, effective: effectiveHost, real: realHost, url: url.hostname },
      resolution,
      domains,
      campamento,
      publicSaas,
      db: { status: dbStatus, reason: dbReason },
      dbSnapshot: { missingTables },
      hints,
      build: buildStamp,
      tenantFallback: DEMO_TENANT_ID,
    },
    noStoreHeaders,
  );
}
