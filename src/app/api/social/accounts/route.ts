export const dynamic = "force-dynamic";

import { NextResponse } from "next/server";
import { requireTenantAccess, UnauthorizedError } from "@/lib/auth/session";
import { connectIntegration, disconnectIntegration, validateIntegrationConnection } from "@/lib/integration-core";
import { ensureLinkedInIntegrationAvailable, LINKEDIN_INTEGRATION_KEY } from "@/lib/integration-core/providers/linkedin";
import { listSaasSocialAccounts, resolveSocialContext, SocialContextError, upsertSaasSocialAccount } from "@/lib/social/repository";
import type { SaasSocialAccountStatus } from "@/lib/social/types";

const ALLOWED_PROVIDERS = ["INSTAGRAM", "TWITTER_X", "LINKEDIN", "FACEBOOK_PAGE", "TIKTOK", "WHATSAPP", "OTHER"] as const;
const ALLOWED_STATUSES = ["DISCONNECTED", "CONNECTED_DEMO", "CONNECTED_REAL", "PENDING_REAL", "INVALID_CREDENTIALS", "NEEDS_RECONNECTION"] as const;

async function resolveLiveLinkedInAccount(input: {
  id?: string;
  saasId: string;
  handle?: string | null;
  displayName?: string | null;
  authMeta?: Record<string, unknown> | null;
  isPrimary?: boolean;
}, tenantId: string) {
  const accessToken = typeof input.authMeta?.accessToken === "string" ? input.authMeta.accessToken.trim() : "";
  const baseMeta = {
    ...(input.authMeta ?? {}),
    mode: "live",
    provider: "LINKEDIN",
    lastValidationAt: new Date().toISOString(),
  };

  await ensureLinkedInIntegrationAvailable();
  await connectIntegration({
    tenantId,
    saasId: input.saasId,
    integrationKey: LINKEDIN_INTEGRATION_KEY,
    connectionLabel: input.displayName?.trim() || input.handle || "LinkedIn connection",
    status: "PENDING",
    metadata: {
      provider: "LINKEDIN",
      mode: "live",
      handle: input.handle ?? null,
      displayName: input.displayName ?? null,
      isPrimary: input.isPrimary ?? true,
    },
    credentials: {
      accessToken,
      authorUrn: typeof input.authMeta?.authorUrn === "string" ? input.authMeta.authorUrn : null,
      profileId: typeof input.authMeta?.profileId === "string" ? input.authMeta.profileId : null,
    },
  });

  const validation = await validateIntegrationConnection({
    tenantId,
    saasId: input.saasId,
    integrationKey: LINKEDIN_INTEGRATION_KEY,
  });

  if (validation.ok) {
    const displayName =
      typeof validation.connection.metadata?.displayName === "string"
        ? validation.connection.metadata.displayName
        : "LinkedIn user";
    return {
      accountInput: {
        id: input.id,
        saasId: input.saasId,
        provider: "LINKEDIN" as const,
        handle: input.handle ?? null,
        displayName: input.displayName?.trim() || displayName,
        status: "CONNECTED_REAL" as SaasSocialAccountStatus,
        authMeta: {
          ...baseMeta,
          accessToken,
          authorUrn:
            typeof validation.connection.metadata?.authorUrn === "string"
              ? validation.connection.metadata.authorUrn
              : input.authMeta?.authorUrn ?? null,
          profileId:
            typeof validation.connection.metadata?.profileId === "string"
              ? validation.connection.metadata.profileId
              : input.authMeta?.profileId ?? null,
          token_status: "active",
          tenantId,
        },
        isPrimary: input.isPrimary ?? true,
      },
      liveConnection: {
        ok: true,
        code: "LINKEDIN_CONNECTED",
        message: "LinkedIn live connection verified.",
      },
    };
  }

  const accountStatus: SaasSocialAccountStatus =
    validation.status === "INVALID" || validation.status === "NEEDS_REAUTH"
      ? "INVALID_CREDENTIALS"
      : "PENDING_REAL";

  return {
    accountInput: {
      id: input.id,
      saasId: input.saasId,
      provider: "LINKEDIN" as const,
      handle: input.handle ?? null,
      displayName: input.displayName?.trim() || "LinkedIn connection",
      status: accountStatus,
      authMeta: {
        ...baseMeta,
        accessToken,
        token_status: accountStatus === "INVALID_CREDENTIALS" ? "invalid" : "pending",
        lastErrorCode: validation.error?.code ?? "LINKEDIN_CONNECTION_PENDING",
        lastErrorMessage: validation.error?.message ?? "LinkedIn connection could not be verified.",
        tenantId,
      },
      isPrimary: input.isPrimary ?? true,
    },
    liveConnection: {
      ok: false,
      code: validation.error?.code ?? "LINKEDIN_CONNECTION_PENDING",
      message: validation.error?.message ?? "LinkedIn connection could not be verified.",
    },
  };
}

export async function GET(request: Request) {
  try {
    const url = new URL(request.url);
    const saasId = url.searchParams.get("saasId");
    if (!saasId) {
      return NextResponse.json({ code: "INVALID_PARAMS", message: "saasId is required" }, { status: 400 });
    }
    const { tenantId } = await requireTenantAccess(request);
    const ctx = await resolveSocialContext({ tenantId, saasId });
    const items = await listSaasSocialAccounts(ctx);
    return NextResponse.json({ items, count: items.length });
  } catch (error) {
    if (error instanceof SocialContextError) {
      return NextResponse.json({ code: "INVALID_SOCIAL_CONTEXT", message: error.message }, { status: 400 });
    }
    if (error instanceof UnauthorizedError) {
      return NextResponse.json({ code: "UNAUTHORIZED", message: error.message }, { status: error.status });
    }
    console.error("SOCIAL_ACCOUNTS_LIST_ERROR", error);
    return NextResponse.json({ code: "SOCIAL_ERROR", message: "No se pudieron cargar las cuentas" }, { status: 500 });
  }
}

export async function POST(request: Request) {
  try {
    const body = (await request.json().catch(() => null)) as {
      id?: string;
      saasId?: string | null;
      provider?: string;
      handle?: string | null;
      displayName?: string | null;
      status?: string;
      authMeta?: Record<string, unknown> | null;
      isPrimary?: boolean;
    } | null;
    if (!body) {
      return NextResponse.json({ code: "INVALID_BODY", message: "Body is required" }, { status: 400 });
    }
    const saasId = body.saasId ?? null;
    if (!saasId || !body.provider || !body.status) {
      return NextResponse.json({ code: "INVALID_BODY", message: "saasId, provider and status are required" }, { status: 400 });
    }
    const { tenantId } = await requireTenantAccess(request);
    const ctx = await resolveSocialContext({ tenantId, saasId });
    if (!ALLOWED_PROVIDERS.includes(body.provider as (typeof ALLOWED_PROVIDERS)[number])) {
      return NextResponse.json({ code: "INVALID_PROVIDER", message: "provider is invalid" }, { status: 400 });
    }
    if (!ALLOWED_STATUSES.includes(body.status as (typeof ALLOWED_STATUSES)[number])) {
      return NextResponse.json({ code: "INVALID_STATUS", message: "status is invalid" }, { status: 400 });
    }
    const provider = body.provider as (typeof ALLOWED_PROVIDERS)[number];
    const status = body.status as SaasSocialAccountStatus;
    if (provider === "LINKEDIN" && body.authMeta?.mode === "live" && status === "CONNECTED_REAL") {
      const liveAccount = await resolveLiveLinkedInAccount({
        id: body.id,
        saasId,
        handle: body.handle ?? null,
        displayName: body.displayName ?? null,
        authMeta: body.authMeta ?? null,
        isPrimary: body.isPrimary,
      }, tenantId);
      const account = await upsertSaasSocialAccount(ctx, liveAccount.accountInput);
      return NextResponse.json({ account, liveConnection: liveAccount.liveConnection });
    }
    const account = await upsertSaasSocialAccount(ctx, {
      id: body.id,
      saasId,
      provider,
      handle: body.handle ?? null,
      displayName: body.displayName ?? null,
      status,
      authMeta: body.authMeta ?? null,
      isPrimary: body.isPrimary ?? false,
    });
    return NextResponse.json({ account });
  } catch (error) {
    if (error instanceof SocialContextError) {
      return NextResponse.json({ code: "INVALID_SOCIAL_CONTEXT", message: error.message }, { status: 400 });
    }
    if (error instanceof UnauthorizedError) {
      return NextResponse.json({ code: "UNAUTHORIZED", message: error.message }, { status: error.status });
    }
    console.error("SOCIAL_ACCOUNTS_UPSERT_ERROR", error);
    return NextResponse.json({ code: "SOCIAL_ERROR", message: "No se pudo guardar la cuenta" }, { status: 500 });
  }
}

export async function PATCH(request: Request) {
  try {
    const body = (await request.json().catch(() => null)) as {
      id?: string;
      saasId?: string | null;
      provider?: string;
      handle?: string | null;
      displayName?: string | null;
      status?: string;
      authMeta?: Record<string, unknown> | null;
      isPrimary?: boolean;
    } | null;
    if (!body?.id || !body.saasId) {
      return NextResponse.json({ code: "INVALID_BODY", message: "id and saasId are required" }, { status: 400 });
    }

    const { tenantId } = await requireTenantAccess(request);
    const ctx = await resolveSocialContext({ tenantId, saasId: body.saasId });
    const current = (await listSaasSocialAccounts(ctx)).find((account) => account.id === body.id);
    if (!current) {
      return NextResponse.json({ code: "NOT_FOUND", message: "Account not found" }, { status: 404 });
    }

    const nextProvider = (body.provider ?? current.provider) as (typeof ALLOWED_PROVIDERS)[number];
    const nextStatus = (body.status ?? current.status) as SaasSocialAccountStatus;
    if (!ALLOWED_PROVIDERS.includes(nextProvider as (typeof ALLOWED_PROVIDERS)[number])) {
      return NextResponse.json({ code: "INVALID_PROVIDER", message: "provider is invalid" }, { status: 400 });
    }
    if (!ALLOWED_STATUSES.includes(nextStatus as (typeof ALLOWED_STATUSES)[number])) {
      return NextResponse.json({ code: "INVALID_STATUS", message: "status is invalid" }, { status: 400 });
    }

    if (nextProvider === "LINKEDIN" && body.authMeta?.mode === "live" && nextStatus === "CONNECTED_REAL") {
      const liveAccount = await resolveLiveLinkedInAccount({
        id: current.id,
        saasId: current.saasId,
        handle: typeof body.handle === "undefined" ? current.handle : body.handle,
        displayName: typeof body.displayName === "undefined" ? current.displayName : body.displayName,
        authMeta: body.authMeta ?? current.authMeta,
        isPrimary: typeof body.isPrimary === "boolean" ? body.isPrimary : current.isPrimary,
      }, tenantId);
      const account = await upsertSaasSocialAccount(ctx, liveAccount.accountInput);
      return NextResponse.json({ account, liveConnection: liveAccount.liveConnection });
    }

    const account = await upsertSaasSocialAccount(ctx, {
      id: current.id,
      saasId: current.saasId,
      provider: nextProvider as (typeof ALLOWED_PROVIDERS)[number],
      handle: typeof body.handle === "undefined" ? current.handle : body.handle,
      displayName: typeof body.displayName === "undefined" ? current.displayName : body.displayName,
      status: nextStatus as (typeof ALLOWED_STATUSES)[number],
      authMeta: typeof body.authMeta === "undefined" ? current.authMeta : body.authMeta,
      isPrimary: typeof body.isPrimary === "boolean" ? body.isPrimary : current.isPrimary,
    });
    return NextResponse.json({ account });
  } catch (error) {
    if (error instanceof SocialContextError) {
      return NextResponse.json({ code: "INVALID_SOCIAL_CONTEXT", message: error.message }, { status: 400 });
    }
    if (error instanceof UnauthorizedError) {
      return NextResponse.json({ code: "UNAUTHORIZED", message: error.message }, { status: error.status });
    }
    console.error("SOCIAL_ACCOUNTS_PATCH_ERROR", error);
    return NextResponse.json({ code: "SOCIAL_ERROR", message: "No se pudo actualizar la cuenta" }, { status: 500 });
  }
}

export async function DELETE(request: Request) {
  try {
    const body = (await request.json().catch(() => null)) as { id?: string; saasId?: string | null } | null;
    if (!body?.id || !body.saasId) {
      return NextResponse.json({ code: "INVALID_BODY", message: "id and saasId are required" }, { status: 400 });
    }

    const { tenantId } = await requireTenantAccess(request);
    const ctx = await resolveSocialContext({ tenantId, saasId: body.saasId });
    const accounts = await listSaasSocialAccounts(ctx);
    const current = accounts.find((account) => account.id === body.id);
    if (!current) {
      return NextResponse.json({ code: "NOT_FOUND", message: "Account not found" }, { status: 404 });
    }

    const account = await upsertSaasSocialAccount(ctx, {
      id: current.id,
      saasId: current.saasId,
      provider: current.provider,
      handle: current.handle,
      displayName: current.displayName,
      status: "DISCONNECTED",
      authMeta: {
        ...(current.authMeta ?? {}),
        disconnectedAt: new Date().toISOString(),
      },
      isPrimary: false,
    });

    if (current.provider === "LINKEDIN") {
      try {
        await ensureLinkedInIntegrationAvailable();
        await disconnectIntegration(ctx.tenantId, current.saasId, LINKEDIN_INTEGRATION_KEY);
      } catch (error) {
        console.error("SOCIAL_ACCOUNTS_DISCONNECT_LINKEDIN_CORE_ERROR", error);
      }
    }

    if (current.isPrimary) {
      const fallbackPrimary = accounts.find((candidate) => candidate.id !== current.id && candidate.status !== "DISCONNECTED");
      if (fallbackPrimary) {
        await upsertSaasSocialAccount(ctx, {
          id: fallbackPrimary.id,
          saasId: fallbackPrimary.saasId,
          provider: fallbackPrimary.provider,
          handle: fallbackPrimary.handle,
          displayName: fallbackPrimary.displayName,
          status: fallbackPrimary.status,
          authMeta: fallbackPrimary.authMeta,
          isPrimary: true,
        });
      }
    }

    return NextResponse.json({ account });
  } catch (error) {
    if (error instanceof SocialContextError) {
      return NextResponse.json({ code: "INVALID_SOCIAL_CONTEXT", message: error.message }, { status: 400 });
    }
    if (error instanceof UnauthorizedError) {
      return NextResponse.json({ code: "UNAUTHORIZED", message: error.message }, { status: error.status });
    }
    console.error("SOCIAL_ACCOUNTS_DELETE_ERROR", error);
    return NextResponse.json({ code: "SOCIAL_ERROR", message: "No se pudo desconectar la cuenta" }, { status: 500 });
  }
}
