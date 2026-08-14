export const dynamic = "force-dynamic";

// SSO handoff — Step 1.
// Called from drako.systems while the user holds a valid Campamento Base session.
// Validates the drakos session cookie, checks the tenant's SocialFlow subscription,
// issues a single-use token (60s TTL) stored in DRACO_DB, and redirects to the
// SocialFlow exchange endpoint on socialflows.drako.systems.

import { NextResponse } from "next/server";
import { requireSession } from "@/lib/auth/session";
import { run } from "@/lib/db";
import { getCanonicalSubscriptionState, isInternalAccount } from "@/lib/billing/subscriptions";

const SOCIALFLOW_ORIGIN =
  process.env.SOCIALFLOW_SSO_ORIGIN ?? "https://socialflows.drako.systems";

const SSO_TOKEN_TTL_MS = 60_000;

const ENTITLED_STATUSES = new Set(["active", "trialing", "trial"]);

function normalizeDrakosRole(role: string | undefined): "admin" | "user" {
  const r = (role ?? "").toLowerCase();
  if (r === "admin" || r === "owner" || r === "superadmin") return "admin";
  return "user";
}

export async function GET(request: Request) {
  let session: Awaited<ReturnType<typeof requireSession>>;
  try {
    session = await requireSession(request);
  } catch {
    return NextResponse.redirect(
      `${SOCIALFLOW_ORIGIN}/socialflow/auth?error=AUTH_REQUIRED`,
      { status: 302 },
    );
  }

  const subscription = await getCanonicalSubscriptionState({
    tenantId: session.tenantId,
    saasSlug: "socialflow",
  });

  const entitled = Boolean(subscription && ENTITLED_STATUSES.has(subscription.status));
  // getCanonicalSubscriptionState() devuelve null para cuentas internas (no tienen
  // Stripe real que verificar) — solo se consulta internal_accounts cuando el check
  // normal ya falló, para no añadir una query extra al camino feliz de cada tenant.
  if (!entitled && !(await isInternalAccount(session.tenantId, "socialflow"))) {
    return NextResponse.redirect(
      `${SOCIALFLOW_ORIGIN}/socialflow/auth?error=NO_SUBSCRIPTION`,
      { status: 302 },
    );
  }

  const tokenId = crypto.randomUUID();
  const expiresAt = new Date(Date.now() + SSO_TOKEN_TTL_MS).toISOString();
  const role = normalizeDrakosRole(session.role);

  try {
    await run(
      `INSERT INTO sso_tokens (id, tenant_id, email, role, expires_at)
       VALUES (?, ?, ?, ?, ?)`,
      tokenId,
      session.tenantId,
      session.email,
      role,
      expiresAt,
    );
  } catch (err) {
    console.error("SSO_TOKEN_CREATE_FAILED", err instanceof Error ? err.message : String(err));
    return NextResponse.redirect(
      `${SOCIALFLOW_ORIGIN}/socialflow/auth?error=SSO_FAILED`,
      { status: 302 },
    );
  }

  const url = new URL(request.url);
  const redirectAfter = url.searchParams.get("redirect") ?? "";

  const exchangeUrl = new URL(`${SOCIALFLOW_ORIGIN}/api/socialflow/auths/sso-exchange`);
  exchangeUrl.searchParams.set("token", tokenId);
  if (redirectAfter) exchangeUrl.searchParams.set("redirect", redirectAfter);

  return NextResponse.redirect(exchangeUrl.toString(), { status: 302 });
}
