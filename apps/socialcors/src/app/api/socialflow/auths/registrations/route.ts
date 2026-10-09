export const dynamic = "force-dynamic";

import { NextResponse } from "next/server";
import { enforceSocialFlowAuthBoundary } from "@/lib/socialflow/platform/auth/boundary";
import { isAuthsIsolationEnabled, isTelemetriesHoldingEnabled } from "@/lib/socialflow/platform/auth/flags";
import { jsonError, setSocialFlowSessionCookie } from "@/lib/socialflow/platform/auth/http";
import { loginSocialFlowUser, registerSocialFlowUser } from "@/lib/socialflow/platform/auth/services";
import { recordCampamentoEvent } from "@/lib/empire/events";
import { run } from "@/lib/db";
import { recordTermsAcceptance } from "@/lib/socialflow/auth/terms-acceptance";

type RegistrationBody = {
  email?: string;
  password?: string;
  name?: string;
  /** El cliente debe marcar la casilla de Términos y Política de privacidad. */
  acceptedTerms?: boolean;
  /** Tipo de cuenta: "influencer" o "empresa". Determina el plan de trial inicial. */
  accountType?: "influencer" | "empresa";
};

export async function POST(request: Request) {
  if (!isAuthsIsolationEnabled()) {
    return jsonError("AUTHS_ISOLATIONS_DISABLED", "Auth isolation is disabled.", 503);
  }

  const boundary = enforceSocialFlowAuthBoundary({ request, endpoint: "/api/socialflow/auths/registrations" });
  if (!boundary.ok) return boundary.response;
  const body = (await request.json().catch(() => null)) as RegistrationBody | null;
  if (!body?.email || !body.password) {
    return jsonError("INVALID_INPUT", "Email and password are required.");
  }

  const trialPlanCode = body.accountType === "empresa" ? "empresa_starter" : "influencer_starter";

  // Aceptación de los Términos de servicio y la Política de privacidad (casilla del formulario).
  if (body.acceptedTerms !== true) {
    return jsonError("TERMS_NOT_ACCEPTED", "Debes aceptar los Términos de servicio y la Política de privacidad.", 400);
  }

  const registration = await registerSocialFlowUser({
    email: body.email,
    password: body.password,
    name: body.name ?? null,
    tenantId: crypto.randomUUID(),
  });
  if (!registration.ok) {
    return jsonError(registration.code, registration.message, registration.code === "EMAIL_EXISTS" ? 409 : 400);
  }

  // Prueba de la aceptación: fecha/hora en socialflow_users.accepted_terms_at (no bloquea el alta si falla).
  await recordTermsAcceptance(registration.userId);

  const login = await loginSocialFlowUser({
    email: body.email,
    password: body.password,
  });
  if (!login.ok) {
    return jsonError(login.code, login.message, 401);
  }

  // Activate 15-day free trial in saas_subscriptions (no Stripe required)
  const trialEndsAt = new Date(Date.now() + 15 * 24 * 60 * 60 * 1000).toISOString();
  const nowIso = new Date().toISOString();
  await run(
    `INSERT INTO saas_subscriptions (id, tenant_id, saas_slug, plan_code, status, current_period_end, created_at, updated_at)
     VALUES (?, ?, 'socialflow', ?, 'trial', ?, ?, ?)
     ON CONFLICT(tenant_id, saas_slug) DO NOTHING`,
    `${login.tenantId}:socialflow`,
    login.tenantId,
    trialPlanCode,
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
      saas_slug: "socialflow",
    },
  }, { status: 201 });

  setSocialFlowSessionCookie({ response, token: login.token });

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
