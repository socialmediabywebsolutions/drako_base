/**
 * /api/socialflow/auth — façade unificada de autenticación.
 *
 * El componente SocialFlowAuthExperience envía:
 *   POST /api/socialflow/auth  { email, password, isLogin }
 *
 * Este handler delega directamente en los servicios canónicos:
 *   isLogin=true  → loginSocialFlowUser  (igual que /api/socialflow/auths/logins)
 *   isLogin=false → registerSocialFlowUser + loginSocialFlowUser
 *                   (igual que /api/socialflow/auths/registrations)
 *
 * No hace fetch interno para evitar problemas de auto-llamada en CF Workers.
 */
export const dynamic = "force-dynamic";

import { NextResponse } from "next/server";
import { enforceSocialFlowAuthBoundary } from "@/lib/socialflow/platform/auth/boundary";
import { isAuthsIsolationEnabled } from "@/lib/socialflow/platform/auth/flags";
import { jsonError, setSocialFlowSessionCookie } from "@/lib/socialflow/platform/auth/http";
import { loginSocialFlowUser, registerSocialFlowUser } from "@/lib/socialflow/platform/auth/services";
import { run } from "@/lib/db";
import { recordTermsAcceptance } from "@/lib/socialflow/auth/terms-acceptance";

type AuthBody = {
  email?: string;
  password?: string;
  isLogin?: boolean;
};

export async function POST(request: Request) {
  if (!isAuthsIsolationEnabled()) {
    return jsonError("AUTHS_ISOLATIONS_DISABLED", "Auth isolation is disabled.", 503);
  }

  const boundary = enforceSocialFlowAuthBoundary({ request, endpoint: "/api/socialflow/auth" });
  if (!boundary.ok) return boundary.response;

  let body: AuthBody | null = null;
  try {
    body = (await request.json()) as AuthBody;
  } catch {
    return jsonError("INVALID_JSON", "Invalid JSON body.", 400);
  }

  if (!body?.email || !body.password) {
    return jsonError("INVALID_INPUT", "Email and password are required.");
  }

  const isLogin = body.isLogin !== false; // default: login

  // ── LOGIN ────────────────────────────────────────────────────────────────────
  if (isLogin) {
    const login = await loginSocialFlowUser({
      email: body.email,
      password: body.password,
    });
    if (!login.ok) {
      return jsonError(login.code, login.message, 401);
    }

    const response = NextResponse.json({
      ok: true,
      role: login.role,
      tenantId: login.tenantId,
      saas_slug: "socialflow",
    });
    setSocialFlowSessionCookie({ response, token: login.token });
    return response;
  }

  // ── REGISTRO ─────────────────────────────────────────────────────────────────
  // El formulario de registro simplificado implica aceptación de términos.
  // El componente puede evolucionar para enviar acceptedTerms explícitamente;
  // mientras tanto, este endpoint asume la aceptación desde el submit del form.
  const registration = await registerSocialFlowUser({
    email: body.email,
    password: body.password,
    name: null,
    tenantId: crypto.randomUUID(),
  });
  if (!registration.ok) {
    return jsonError(
      registration.code,
      registration.message,
      registration.code === "EMAIL_EXISTS" ? 409 : 400,
    );
  }

  await recordTermsAcceptance(registration.userId);

  const login = await loginSocialFlowUser({
    email: body.email,
    password: body.password,
  });
  if (!login.ok) {
    return jsonError(login.code, login.message, 401);
  }

  // Activar trial de 15 días
  const trialEndsAt = new Date(Date.now() + 15 * 24 * 60 * 60 * 1000).toISOString();
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

  const response = NextResponse.json(
    {
      ok: true,
      user: {
        id: registration.userId,
        email: body.email.trim().toLowerCase(),
        role: login.role,
        tenantId: login.tenantId,
        saas_slug: "socialflow",
      },
    },
    { status: 201 },
  );
  setSocialFlowSessionCookie({ response, token: login.token });
  return response;
}
