export const dynamic = "force-dynamic";

import { NextResponse } from "next/server";
import { enforceSocialFlowAuthBoundary } from "@/lib/socialflow/platform/auth/boundary";
import { isAuthsIsolationEnabled, isTelemetriesHoldingEnabled } from "@/lib/socialflow/platform/auth/flags";
import { jsonError, setSocialFlowSessionCookie } from "@/lib/socialflow/platform/auth/http";
import { loginSocialFlowUser, registerSocialFlowUser } from "@/lib/socialflow/platform/auth/services";
import { recordCampamentoEvent } from "@/lib/empire/events";
import { run } from "@/lib/db";
import { recordTermsAcceptance } from "@/lib/socialflow/auth/terms-acceptance";
import { sendEmail } from "@/lib/socialflow/platform/email";

const SOCIALFLOW_ORIGIN =
  process.env.SOCIALFLOW_SSO_ORIGIN ?? "https://socialcors.com";

function welcomeEmailHtml(name: string | null, trialDays: number): string {
  const firstName = name?.trim().split(/\s+/)[0] ?? null;
  const greeting = firstName ? `Hola ${firstName},` : "Hola,";
  const dashboardUrl = `${SOCIALFLOW_ORIGIN}/socialflow`;
  const connectUrl = `${SOCIALFLOW_ORIGIN}/socialflow/redes`;
  const knowledgeUrl = `${SOCIALFLOW_ORIGIN}/socialflow/knowledge`;

  return `<!DOCTYPE html>
<html lang="es">
<head><meta charset="UTF-8"><meta name="viewport" content="width=device-width,initial-scale=1"></head>
<body style="margin:0;padding:0;background:#f0f4ff;font-family:-apple-system,BlinkMacSystemFont,'Segoe UI',sans-serif;">
  <table width="100%" cellpadding="0" cellspacing="0">
    <tr><td align="center" style="padding:40px 16px;">
      <table width="520" cellpadding="0" cellspacing="0" style="background:#ffffff;border:1px solid #e2e8f0;border-radius:16px;overflow:hidden;">
        <!-- Header -->
        <tr><td style="background:linear-gradient(135deg,#3b82f6,#06b6d4);padding:32px 40px 28px;">
          <p style="margin:0 0 4px;font-size:11px;font-weight:800;letter-spacing:0.25em;text-transform:uppercase;color:rgba(255,255,255,0.8);">Socialcors</p>
          <h1 style="margin:0;font-size:26px;font-weight:900;color:#ffffff;letter-spacing:-0.02em;">
            Tu cuenta está lista 🚀
          </h1>
        </td></tr>
        <!-- Body -->
        <tr><td style="padding:36px 40px;">
          <p style="margin:0 0 20px;font-size:16px;color:#1e293b;line-height:1.6;">${greeting}</p>
          <p style="margin:0 0 20px;font-size:15px;color:#475569;line-height:1.7;">
            Bienvenido a <strong style="color:#3b82f6;">Socialcors</strong> — el sistema operativo de marketing con IA que gestiona, automatiza y optimiza tus redes sociales.
          </p>
          <!-- Trial box -->
          <table width="100%" cellpadding="0" cellspacing="0" style="margin-bottom:28px;">
            <tr><td style="background:#eff6ff;border:1px solid #bfdbfe;border-radius:12px;padding:18px 24px;">
              <p style="margin:0 0 4px;font-size:11px;font-weight:800;letter-spacing:0.2em;text-transform:uppercase;color:#3b82f6;">Tu prueba gratuita</p>
              <p style="margin:0;font-size:22px;font-weight:900;color:#1e40af;">${trialDays} días gratis</p>
              <p style="margin:4px 0 0;font-size:13px;color:#60a5fa;">Sin tarjeta de crédito. Sin compromiso.</p>
            </td></tr>
          </table>
          <!-- Steps -->
          <p style="margin:0 0 16px;font-size:14px;font-weight:700;color:#1e293b;">3 pasos para empezar:</p>
          <table width="100%" cellpadding="0" cellspacing="0" style="margin-bottom:28px;">
            <tr><td style="padding:0 0 12px;">
              <table cellpadding="0" cellspacing="0"><tr>
                <td style="width:28px;height:28px;background:linear-gradient(135deg,#3b82f6,#06b6d4);border-radius:50%;text-align:center;vertical-align:middle;">
                  <span style="color:#fff;font-size:12px;font-weight:800;">1</span>
                </td>
                <td style="padding-left:12px;font-size:14px;color:#475569;">
                  <a href="${connectUrl}" style="color:#3b82f6;font-weight:600;text-decoration:none;">Conecta Instagram</a> — para que el Cerebro pueda publicar por ti
                </td>
              </tr></table>
            </td></tr>
            <tr><td style="padding:0 0 12px;">
              <table cellpadding="0" cellspacing="0"><tr>
                <td style="width:28px;height:28px;background:linear-gradient(135deg,#3b82f6,#06b6d4);border-radius:50%;text-align:center;vertical-align:middle;">
                  <span style="color:#fff;font-size:12px;font-weight:800;">2</span>
                </td>
                <td style="padding-left:12px;font-size:14px;color:#475569;">
                  <a href="${knowledgeUrl}" style="color:#3b82f6;font-weight:600;text-decoration:none;">Rellena tu base de conocimiento</a> — tu marca, tu audiencia, tu estilo
                </td>
              </tr></table>
            </td></tr>
            <tr><td>
              <table cellpadding="0" cellspacing="0"><tr>
                <td style="width:28px;height:28px;background:linear-gradient(135deg,#3b82f6,#06b6d4);border-radius:50%;text-align:center;vertical-align:middle;">
                  <span style="color:#fff;font-size:12px;font-weight:800;">3</span>
                </td>
                <td style="padding-left:12px;font-size:14px;color:#475569;">
                  Crea tu primer contenido — sube una foto y la IA hace el resto
                </td>
              </tr></table>
            </td></tr>
          </table>
          <!-- CTA -->
          <table cellpadding="0" cellspacing="0" style="margin-bottom:32px;">
            <tr><td style="border-radius:12px;background:linear-gradient(135deg,#3b82f6,#06b6d4);">
              <a href="${dashboardUrl}"
                 style="display:inline-block;padding:14px 32px;font-size:15px;font-weight:800;color:#ffffff;text-decoration:none;letter-spacing:0.02em;">
                Ir al dashboard →
              </a>
            </td></tr>
          </table>
          <p style="margin:0;font-size:13px;color:#94a3b8;line-height:1.6;">
            Si tienes cualquier duda, responde a este email. Estamos aquí para ayudarte.
          </p>
        </td></tr>
        <!-- Footer -->
        <tr><td style="border-top:1px solid #e2e8f0;padding:20px 40px;">
          <p style="margin:0;font-size:12px;color:#94a3b8;text-align:center;">
            © 2024 Socialcors · <a href="https://socialcors.com/privacidad" style="color:#94a3b8;">Privacidad</a> · <a href="https://socialcors.com/terminos" style="color:#94a3b8;">Términos</a>
          </p>
        </td></tr>
      </table>
    </td></tr>
  </table>
</body>
</html>`;
}

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

  // Email de bienvenida — fire-and-forget, nunca bloquea el registro.
  sendEmail({
    to: body.email.trim().toLowerCase(),
    subject: "¡Bienvenido a Socialcors! Tu prueba de 15 días ha comenzado",
    html: welcomeEmailHtml(body.name ?? null, 15),
  }).catch((err) => {
    console.error("SOCIALFLOW_WELCOME_EMAIL_ERROR", err instanceof Error ? err.message : String(err));
  });

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
