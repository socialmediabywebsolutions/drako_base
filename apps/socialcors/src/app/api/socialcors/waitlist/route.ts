export const dynamic = "force-dynamic";

/**
 * POST /api/socialcors/waitlist
 *
 * Guarda el registro en D1 (socialcors_waitlist) y envía email de notificación
 * a Cristóbal vía Resend.
 *
 * Body: { email: string, product: string, profile: string }
 */

import { NextRequest, NextResponse } from "next/server";
import { run } from "@/lib/db";
import { sendEmail } from "@/lib/socialflow/platform/email";

const PRODUCT_LABELS: Record<string, string> = {
  mentoria: "Mentoría IA",
  cazh:     "Cazh (finanzas)",
  rentia:   "Rentia (alquileres)",
  health:   "Health IA",
  todo:     "Todo el ecosistema",
};

const PROFILE_LABELS: Record<string, string> = {
  familia:     "Familia / Estudiante",
  propietario: "Propietario de vivienda",
  inversor:    "Inversor / Fondo",
  prensa:      "Prensa / Media",
  otro:        "Otro",
};

export async function POST(req: NextRequest) {
  try {
    const body = await req.json();
    const { email, product, profile } = body ?? {};

    // Validación mínima
    if (
      typeof email   !== "string" || !email.includes("@") ||
      typeof product !== "string" || !product ||
      typeof profile !== "string" || !profile
    ) {
      return NextResponse.json(
        { error: "Datos incompletos" },
        { status: 400 },
      );
    }

    const emailLower  = email.trim().toLowerCase();
    const productClean = product.trim().toLowerCase();
    const profileClean = profile.trim().toLowerCase();

    // Guardar en D1 — ignorar duplicados (mismo email + producto)
    await run(
      `INSERT OR IGNORE INTO socialcors_waitlist (email, product_interest, profile_type, created_at)
       VALUES (?, ?, ?, datetime('now'))`,
      [emailLower, productClean, profileClean],
    );

    // Notificación a Cristóbal
    const productLabel = PRODUCT_LABELS[productClean] ?? productClean;
    const profileLabel = PROFILE_LABELS[profileClean] ?? profileClean;

    await sendEmail({
      to:      "socialmediabywebsolutions@gmail.com",
      subject: `🎯 Nueva inscripción waitlist — ${productLabel}`,
      html: `
<!DOCTYPE html>
<html lang="es">
<head><meta charset="UTF-8"></head>
<body style="margin:0;padding:0;background:#f8fafc;font-family:-apple-system,BlinkMacSystemFont,'Segoe UI',sans-serif;">
  <table width="100%" cellpadding="0" cellspacing="0">
    <tr><td align="center" style="padding:32px 16px;">
      <table width="480" cellpadding="0" cellspacing="0" style="background:#ffffff;border:1px solid #e2e8f0;border-radius:16px;overflow:hidden;">
        <tr>
          <td style="background:linear-gradient(135deg,#3b82f6,#06b6d4);padding:24px 32px;">
            <p style="margin:0;color:#ffffff;font-size:12px;font-weight:700;letter-spacing:0.1em;text-transform:uppercase;opacity:0.85;">Socialcors · Waitlist</p>
            <p style="margin:4px 0 0;color:#ffffff;font-size:22px;font-weight:900;">Nueva inscripción 🎉</p>
          </td>
        </tr>
        <tr>
          <td style="padding:28px 32px;">
            <table width="100%" cellpadding="0" cellspacing="0">
              <tr>
                <td style="padding:10px 0;border-bottom:1px solid #f1f5f9;">
                  <span style="font-size:11px;color:#94a3b8;text-transform:uppercase;font-weight:700;letter-spacing:0.08em;">Email</span><br>
                  <span style="font-size:15px;color:#0f172a;font-weight:600;">${emailLower}</span>
                </td>
              </tr>
              <tr>
                <td style="padding:10px 0;border-bottom:1px solid #f1f5f9;">
                  <span style="font-size:11px;color:#94a3b8;text-transform:uppercase;font-weight:700;letter-spacing:0.08em;">Producto</span><br>
                  <span style="font-size:15px;color:#0f172a;font-weight:600;">${productLabel}</span>
                </td>
              </tr>
              <tr>
                <td style="padding:10px 0;">
                  <span style="font-size:11px;color:#94a3b8;text-transform:uppercase;font-weight:700;letter-spacing:0.08em;">Perfil</span><br>
                  <span style="font-size:15px;color:#0f172a;font-weight:600;">${profileLabel}</span>
                </td>
              </tr>
            </table>
          </td>
        </tr>
        <tr>
          <td style="padding:0 32px 24px;">
            <p style="margin:0;font-size:12px;color:#94a3b8;">Drako · socialcors.com</p>
          </td>
        </tr>
      </table>
    </td></tr>
  </table>
</body>
</html>`,
    });

    return NextResponse.json({ ok: true });
  } catch (err) {
    console.error("[waitlist] Error:", err);
    return NextResponse.json(
      { error: "Error interno" },
      { status: 500 },
    );
  }
}
