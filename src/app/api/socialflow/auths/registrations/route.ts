export const dynamic = "force-dynamic";

import { NextResponse } from "next/server";
import { socialflowAuths } from "@/lib/auths/socialflow-auths";
import { jsonError, setAuthsSessionCookie } from "@/lib/auths/http";
import { isAuthsIsolationEnabled, isTelemetriesHoldingEnabled } from "@/lib/auths/flags";
import { recordCampamentoEvent } from "@/lib/empire/events";
import { enforceAuthBoundary, resolveSaasSlugForAuthContext } from "@/lib/auths/ssot";
import { run } from "@/lib/db";

type RegistrationBody = {
  email?: string;
  password?: string;
  name?: string;
};

export async function POST(request: Request) {
  if (!isAuthsIsolationEnabled()) {
    return jsonError("AUTHS_ISOLATIONS_DISABLED", "Auth isolation is disabled.", 503);
  }

  const boundary = enforceAuthBoundary({ request, expectedContext: "socialflow", endpoint: "/api/socialflow/auths/registrations" });
  if (!boundary.ok) return boundary.response;
  const body = (await request.json().catch(() => null)) as RegistrationBody | null;
  if (!body?.email || !body.password) {
    return jsonError("INVALID_INPUT", "Email and password are required.");
  }

  const registration = await socialflowAuths.register({
    context: "socialflow",
    email: body.email,
    password: body.password,
    name: body.name ?? null,
    tenantId: crypto.randomUUID(),
  });
  if (!registration.ok) {
    return jsonError(registration.code, registration.message, registration.code === "EMAIL_EXISTS" ? 409 : 400);
  }

  const login = await socialflowAuths.login({
    context: "socialflow",
    email: body.email,
    password: body.password,
  });
  if (!login.ok) {
    return jsonError(login.code, login.message, 401);
  }

  // Activate 7-day free trial in saas_subscriptions (no Stripe required)
  const trialEndsAt = new Date(Date.now() + 7 * 24 * 60 * 60 * 1000).toISOString();
  const nowIso = new Date().toISOString();
  await run(
    `INSERT INTO saas_subscriptions (id, tenant_id, saas_slug, plan_code, status, current_period_end, created_at, updated_at)
     VALUES (?, ?, 'socialflow', 'influencer_starter', 'trial', ?, ?, ?)
     ON CONFLICT(tenant_id, saas_slug) DO NOTHING`,
    `${login.tenantId}:socialflow`,
    login.tenantId,
    trialEndsAt,
    nowIso,
    nowIso,
  ).catch((err) => {
    console.error("SOCIALFLOW_TRIAL_CREATE_ERROR", err);
  });

  const response = NextResponse.json({
    ok: true,
    user: {
      id: registration.userId,
      email: body.email.trim().toLowerCase(),
      role: login.role,
      tenantId: login.tenantId,
      saas_slug: resolveSaasSlugForAuthContext("socialflow"),
    },
  }, { status: 201 });

  setAuthsSessionCookie({ response, context: "socialflow", token: login.token });

  if (isTelemetriesHoldingEnabled()) {
    await recordCampamentoEvent({
      tenantId: login.tenantId,
      saasId: null,
      type: "telemetry.user_registered",
      severity: "INFO",
      source: "SOCIALFLOW_AUTHS",
      message: "User registered in socialflow auth boundary.",
      metadata: { saas_slug: "socialflow", event_name: "user_registered" },
      correlationId: request.headers.get("x-drako-correlation-id") ?? crypto.randomUUID(),
    });
  }

  return response;
}
