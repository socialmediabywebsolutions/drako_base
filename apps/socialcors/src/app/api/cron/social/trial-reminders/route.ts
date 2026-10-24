export const dynamic = "force-dynamic";

/**
 * Cron: trial-reminders
 *
 * Envía avisos por email a los tenants cuyo trial de Socialcors expira en:
 *   - 3 días  (primer aviso — motivar a explorar la app)
 *   - 1 día   (último aviso — urgencia para convertir)
 *
 * Schedule: 0 9 * * *  (09:00 UTC, diario)
 * Lock: 23h — nunca se ejecuta dos veces en el mismo día.
 *
 * DBs:
 *   DRACO_DB            → saas_subscriptions  (billing)
 *   SOCIALFLOW_AUTHS_DB → socialflow_users     (email / nombre)
 */

import { NextRequest, NextResponse } from "next/server";
import { CronAuthError, verifyCronAuth } from "@/lib/socialflow/platform/cron/auth";
import { guardCronTurn } from "@/lib/socialflow/platform/cron/lock";
import { env } from "@/lib/cf";
import { sendEmail } from "@/lib/socialflow/platform/email";

const SOCIALFLOW_ORIGIN =
  process.env.SOCIALFLOW_SSO_ORIGIN ?? "https://socialcors.com";

// ── Email templates ────────────────────────────────────────────────────────

function trialReminderHtml(name: string | null, daysLeft: number): string {
  const firstName = name?.trim().split(/\s+/)[0] ?? null;
  const greeting = firstName ? `Hola ${firstName},` : "Hola,";
  const dashboardUrl = `${SOCIALFLOW_ORIGIN}/socialflow`;
  const plansUrl = `${SOCIALFLOW_ORIGIN}/socialflow/settings/billing`;

  const isLastDay = daysLeft <= 1;
  const headline = isLastDay
    ? "Tu prueba gratuita termina mañana"
    : `Tu prueba gratuita termina en ${daysLeft} días`;
  const subline = isLastDay
    ? "Es el momento de elegir tu plan y seguir publicando sin interrupciones."
    : "No pierdas acceso al Cerebro — elige tu plan antes de que termine.";

  return `<!DOCTYPE html>
<html lang="es">
<head><meta charset="UTF-8"><meta name="viewport" content="width=device-width,initial-scale=1"></head>
<body style="margin:0;padding:0;background:#f0f4ff;font-family:-apple-system,BlinkMacSystemFont,'Segoe UI',sans-serif;">
  <table width="100%" cellpadding="0" cellspacing="0">
    <tr><td align="center" style="padding:40px 16px;">
      <table width="520" cellpadding="0" cellspacing="0" style="background:#ffffff;border:1px solid #e2e8f0;border-radius:16px;overflow:hidden;">
        <!-- Header -->
        <tr><td style="background:linear-gradient(135deg,${isLastDay ? "#ef4444,#f97316" : "#3b82f6,#06b6d4"});padding:32px 40px 28px;">
          <p style="margin:0 0 4px;font-size:11px;font-weight:800;letter-spacing:0.25em;text-transform:uppercase;color:rgba(255,255,255,0.8);">Socialcors</p>
          <h1 style="margin:0;font-size:24px;font-weight:900;color:#ffffff;letter-spacing:-0.02em;">${headline} ⏰</h1>
        </td></tr>
        <!-- Body -->
        <tr><td style="padding:36px 40px;">
          <p style="margin:0 0 20px;font-size:16px;color:#1e293b;line-height:1.6;">${greeting}</p>
          <p style="margin:0 0 24px;font-size:15px;color:#475569;line-height:1.7;">${subline}</p>

          <!-- Days left pill -->
          <table width="100%" cellpadding="0" cellspacing="0" style="margin-bottom:28px;">
            <tr><td style="background:${isLastDay ? "#fef2f2" : "#eff6ff"};border:1px solid ${isLastDay ? "#fecaca" : "#bfdbfe"};border-radius:12px;padding:18px 24px;text-align:center;">
              <p style="margin:0;font-size:40px;font-weight:900;color:${isLastDay ? "#dc2626" : "#1e40af"};">${daysLeft}</p>
              <p style="margin:4px 0 0;font-size:13px;color:${isLastDay ? "#ef4444" : "#60a5fa"};font-weight:600;">
                ${daysLeft === 1 ? "día restante" : "días restantes"}
              </p>
            </td></tr>
          </table>

          <p style="margin:0 0 24px;font-size:14px;color:#475569;line-height:1.7;">
            Con Socialcors tu IA sigue generando contenido, publicando y aprendiendo de tu audiencia —
            <strong style="color:#1e293b;">sin que tengas que hacer nada</strong>.
            Elige tu plan para no perder el acceso.
          </p>

          <!-- CTA -->
          <table cellpadding="0" cellspacing="0" style="margin-bottom:24px;">
            <tr><td style="border-radius:12px;background:linear-gradient(135deg,#3b82f6,#06b6d4);">
              <a href="${plansUrl}"
                 style="display:inline-block;padding:14px 32px;font-size:15px;font-weight:800;color:#ffffff;text-decoration:none;letter-spacing:0.02em;">
                Ver planes →
              </a>
            </td></tr>
          </table>
          <p style="margin:0 0 8px;">
            <a href="${dashboardUrl}" style="font-size:13px;color:#3b82f6;text-decoration:none;">
              Ir al dashboard
            </a>
          </p>
          <p style="margin:0;font-size:13px;color:#94a3b8;line-height:1.6;">
            Si tienes dudas sobre los planes, responde a este email.
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

// ── Types ──────────────────────────────────────────────────────────────────

type SubscriptionRow = {
  tenant_id: string;
  current_period_end: string;
};

type UserRow = {
  email: string;
  name: string | null;
};

type ReminderResult = {
  tenantId: string;
  daysLeft: number;
  emailSent: boolean;
  error?: string;
};

// ── Helpers ────────────────────────────────────────────────────────────────

/** Devuelve los tenants cuyo trial expira en `targetDays` días (ventana de ±12h). */
async function findExpiringTrials(
  dracoDb: D1Database,
  targetDays: number,
): Promise<SubscriptionRow[]> {
  const now = Date.now();
  const windowStart = new Date(now + (targetDays - 0.5) * 86_400_000).toISOString();
  const windowEnd   = new Date(now + (targetDays + 0.5) * 86_400_000).toISOString();

  const rows = await dracoDb
    .prepare(
      `SELECT tenant_id, current_period_end
       FROM saas_subscriptions
       WHERE saas_slug = 'socialflow'
         AND status = 'trial'
         AND current_period_end >= ?
         AND current_period_end < ?`,
    )
    .bind(windowStart, windowEnd)
    .all<SubscriptionRow>();

  return rows.results ?? [];
}

/** Busca el email y nombre del primer usuario activo del tenant en SOCIALFLOW_AUTHS_DB. */
async function findTenantUser(
  authsDb: D1Database,
  tenantId: string,
): Promise<UserRow | null> {
  return authsDb
    .prepare(
      `SELECT email, name
       FROM socialflow_users
       WHERE tenant_id = ? AND status = 'active'
       ORDER BY created_at ASC
       LIMIT 1`,
    )
    .bind(tenantId)
    .first<UserRow>();
}

// ── Handler ────────────────────────────────────────────────────────────────

export async function GET(request: NextRequest) {
  try {
    verifyCronAuth(request);
  } catch (error) {
    if (error instanceof CronAuthError) {
      return NextResponse.json({ error: error.message }, { status: error.status });
    }
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const locked = await guardCronTurn(request, "trial-reminders", 23 * 60); // 23h
  if (locked) return locked;

  const bindings = env() as (typeof env extends () => infer T ? T : never) & {
    DRACO_DB?: D1Database;
    SOCIALFLOW_AUTHS_DB?: D1Database;
  };

  const dracoDb = (bindings as Record<string, unknown>).DRACO_DB as D1Database | undefined;
  const authsDb = (bindings as Record<string, unknown>).SOCIALFLOW_AUTHS_DB as D1Database | undefined;

  if (!dracoDb || !authsDb) {
    console.error("TRIAL_REMINDERS_DB_MISSING", { dracoDb: !!dracoDb, authsDb: !!authsDb });
    return NextResponse.json({ ok: false, code: "DB_UNAVAILABLE" }, { status: 503 });
  }

  const results: ReminderResult[] = [];

  // Procesar aviso de 3 días y 1 día en paralelo
  const [expiring3, expiring1] = await Promise.all([
    findExpiringTrials(dracoDb, 3),
    findExpiringTrials(dracoDb, 1),
  ]);

  const allExpiring = [
    ...expiring3.map((r) => ({ ...r, daysLeft: 3 })),
    ...expiring1.map((r) => ({ ...r, daysLeft: 1 })),
  ];

  for (const { tenant_id, daysLeft } of allExpiring) {
    try {
      const user = await findTenantUser(authsDb, tenant_id);
      if (!user?.email) {
        results.push({ tenantId: tenant_id, daysLeft, emailSent: false, error: "NO_USER_EMAIL" });
        continue;
      }

      const subject = daysLeft <= 1
        ? "⏰ Tu prueba de Socialcors termina mañana"
        : `⏰ Tu prueba de Socialcors termina en ${daysLeft} días`;

      const emailResult = await sendEmail({
        to: user.email,
        subject,
        html: trialReminderHtml(user.name, daysLeft),
      });

      results.push({
        tenantId: tenant_id,
        daysLeft,
        emailSent: emailResult.ok,
        error: emailResult.ok ? undefined : emailResult.code,
      });
    } catch (err) {
      results.push({
        tenantId: tenant_id,
        daysLeft,
        emailSent: false,
        error: err instanceof Error ? err.message : "UNKNOWN",
      });
    }
  }

  const sent = results.filter((r) => r.emailSent).length;
  const failed = results.filter((r) => !r.emailSent).length;

  console.log(`[trial-reminders] processed=${results.length} sent=${sent} failed=${failed}`);

  return NextResponse.json({ ok: true, processed: results.length, sent, failed, results });
}
