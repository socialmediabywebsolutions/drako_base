export const dynamic = "force-dynamic";

// SSO handoff — Step 2.
// Called by the browser after being redirected from /api/socialflow/sso-init on drako.systems.
// Validates the one-time token, marks it as used, finds or provisions the SocialFlow user,
// issues a socialflow JWT, sets the session cookie, and redirects to the dashboard.

import { NextResponse } from "next/server";
import { queryOne, run } from "@/lib/db";
import { setSocialFlowSessionCookie } from "@/lib/socialflow/platform/auth/http";
import { resolveSocialFlowAuthsDb } from "@/lib/socialflow/platform/auth/repository";
import { createSocialFlowSessionToken } from "@/lib/socialflow/platform/auth/tokens";

const SOCIALFLOW_ORIGIN =
  process.env.SOCIALFLOW_SSO_ORIGIN ?? "https://socialflows.drako.systems";

const DEFAULT_REDIRECT = "/socialflow/dashboard";

function authError(msg: string): NextResponse {
  return NextResponse.redirect(
    `${SOCIALFLOW_ORIGIN}/socialflow/auth?error=${encodeURIComponent(msg)}`,
    { status: 302 },
  );
}

type SsoTokenRow = {
  id: string;
  tenant_id: string;
  email: string;
  role: "admin" | "user";
  expires_at: string;
  used_at: string | null;
};

type SocialFlowUserRow = {
  id: string;
  email: string;
  role: "admin" | "user";
  tenant_id: string;
  status: string;
};

async function consumeSsoToken(tokenId: string): Promise<SsoTokenRow | null> {
  const now = new Date().toISOString();

  const row = await queryOne<SsoTokenRow>(
    `SELECT id, tenant_id, email, role, expires_at, used_at
     FROM sso_tokens
     WHERE id = ?
     LIMIT 1`,
    tokenId,
  );

  if (!row) return null;
  if (row.used_at !== null) return null;
  if (row.expires_at < now) return null;

  await run(
    `UPDATE sso_tokens SET used_at = ? WHERE id = ? AND used_at IS NULL`,
    now,
    tokenId,
  );

  return row;
}

async function findOrProvisionSocialFlowUser(params: {
  email: string;
  tenantId: string;
  role: "admin" | "user";
}): Promise<{ id: string; tenantId: string; role: "admin" | "user" } | null> {
  const db = resolveSocialFlowAuthsDb();
  if (!db) {
    console.error("SSO_EXCHANGE_NO_SOCIALFLOW_DB");
    return null;
  }

  const existing = await db
    .prepare(
      `SELECT id, email, role, tenant_id, status
       FROM socialflow_users
       WHERE email = ?
       LIMIT 1`,
    )
    .bind(params.email)
    .first<SocialFlowUserRow>();

  if (existing) {
    // Email is UNIQUE — verify tenant matches before granting access.
    if (existing.tenant_id !== params.tenantId) {
      console.error("SSO_EXCHANGE_TENANT_MISMATCH", {
        email: params.email,
        tokenTenantId: params.tenantId,
        userTenantId: existing.tenant_id,
      });
      return null;
    }
    if (existing.status !== "active") {
      console.error("SSO_EXCHANGE_USER_INACTIVE", { email: params.email });
      return null;
    }
    return { id: existing.id, tenantId: existing.tenant_id, role: existing.role };
  }

  // Provision a new SocialFlow user. No credential row — SSO-only login.
  const userId = crypto.randomUUID();
  const now = new Date().toISOString();
  try {
    await db
      .prepare(
        `INSERT INTO socialflow_users (id, email, name, role, tenant_id, status, created_at, updated_at)
         VALUES (?, ?, NULL, ?, ?, 'active', ?, ?)`,
      )
      .bind(userId, params.email, params.role, params.tenantId, now, now)
      .run();
  } catch (err) {
    console.error("SSO_EXCHANGE_PROVISION_FAILED", err instanceof Error ? err.message : String(err));
    return null;
  }

  return { id: userId, tenantId: params.tenantId, role: params.role };
}

export async function GET(request: Request) {
  const url = new URL(request.url);
  const tokenId = url.searchParams.get("token")?.trim() ?? "";
  const redirectAfter = url.searchParams.get("redirect")?.trim() || DEFAULT_REDIRECT;

  if (!tokenId) {
    return authError("MISSING_TOKEN");
  }

  const token = await consumeSsoToken(tokenId);
  if (!token) {
    return authError("INVALID_OR_EXPIRED_TOKEN");
  }

  const user = await findOrProvisionSocialFlowUser({
    email: token.email,
    tenantId: token.tenant_id,
    role: token.role,
  });

  if (!user) {
    return authError("SSO_PROVISION_FAILED");
  }

  let sessionToken: string;
  try {
    sessionToken = await createSocialFlowSessionToken({
      sub: user.id,
      email: token.email,
      tenantId: user.tenantId,
      role: user.role,
    });
  } catch (err) {
    console.error("SSO_EXCHANGE_TOKEN_ISSUE_FAILED", err instanceof Error ? err.message : String(err));
    return authError("SSO_FAILED");
  }

  const safeRedirect = redirectAfter.startsWith("/") ? redirectAfter : DEFAULT_REDIRECT;
  const response = NextResponse.redirect(`${SOCIALFLOW_ORIGIN}${safeRedirect}`, { status: 302 });

  setSocialFlowSessionCookie({ response, token: sessionToken, request });

  return response;
}
