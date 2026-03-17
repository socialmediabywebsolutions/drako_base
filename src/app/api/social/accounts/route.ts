export const dynamic = "force-dynamic";

import { NextResponse } from "next/server";
import { requireTenantAccess, UnauthorizedError } from "@/lib/auth/session";
import { listSaasSocialAccounts, resolveSocialContext, SocialContextError, upsertSaasSocialAccount } from "@/lib/social/repository";
import { LinkedInIntegrationError, verifyLinkedInAccess } from "@/lib/social/linkedin";

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

  try {
    const profile = await verifyLinkedInAccess(accessToken);
    return {
      accountInput: {
        id: input.id,
        saasId: input.saasId,
        provider: "LINKEDIN" as const,
        handle: input.handle ?? null,
        displayName: input.displayName?.trim() || profile.displayName,
        status: "CONNECTED_REAL" as const,
        authMeta: {
          ...baseMeta,
          accessToken,
          authorUrn: profile.authorUrn,
          profileId: profile.profileId,
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
  } catch (error) {
    const normalized = error instanceof LinkedInIntegrationError
      ? error
      : new LinkedInIntegrationError(
        error instanceof Error ? error.message : "LinkedIn connection could not be verified.",
        { code: "LINKEDIN_CONNECTION_PENDING", accountStatus: "PENDING_REAL" },
      );

    return {
      accountInput: {
        id: input.id,
        saasId: input.saasId,
        provider: "LINKEDIN" as const,
        handle: input.handle ?? null,
        displayName: input.displayName?.trim() || "LinkedIn connection",
        status: normalized.accountStatus,
        authMeta: {
          ...baseMeta,
          accessToken,
          token_status: normalized.accountStatus === "INVALID_CREDENTIALS" ? "invalid" : "pending",
          lastErrorCode: normalized.code,
          lastErrorMessage: normalized.message,
          tenantId,
        },
        isPrimary: input.isPrimary ?? true,
      },
      liveConnection: {
        ok: false,
        code: normalized.code,
        message: normalized.message,
      },
    };
  }
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
    const status = body.status as (typeof ALLOWED_STATUSES)[number];
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

    const nextProvider = body.provider ?? current.provider;
    const nextStatus = body.status ?? current.status;
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
