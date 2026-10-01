/**
 * EmailOutreachAgent — Genera y envía emails de prospección personalizados
 *
 * Usa Mistral para crear un email único para cada negocio
 * basado en su descripción, sector y datos públicos.
 * Enviado via Resend desde Socialcors.
 */

import { env } from "@/lib/cf";
import { sendEmail } from "@/lib/email";
import type { SocialFlowProspect } from "./types";

// ─── Generación de contenido ──────────────────────────────────────────────────

async function generateOutreachEmail(prospect: SocialFlowProspect, senderName: string, brandName: string): Promise<{
  subject: string;
  htmlBody: string;
} | null> {
  const bindings = env() as Record<string, unknown> | null;
  const aiBinding = bindings?.AI as { run: (model: string, opts: unknown) => Promise<unknown> } | null;
  if (!aiBinding) return null;

  const businessContext = [
    prospect.businessName,
    prospect.description ? `— ${prospect.description}` : "",
    prospect.instagramHandle ? `Instagram: ${prospect.instagramHandle}` : "",
    prospect.website ? `Web: ${prospect.website}` : "",
    prospect.rating ? `Valoración Google: ${prospect.rating}/5 (${prospect.reviewCount ?? 0} reseñas)` : "",
  ].filter(Boolean).join("\n");

  const prompt = `Eres ${senderName}, fundador de Socialcors (socialcors.com) — una plataforma de gestión de redes sociales con IA.

Escribe un email de prospección en español para este negocio:
${businessContext}

El negocio es de tipo: ${prospect.niche}
Ciudad/zona: ${prospect.location}

El email debe:
- Ser personal y específico para este negocio (no genérico)
- Mencionar algo concreto de su negocio o sector
- Explicar brevemente cómo Socialcors les ayudaría (publicación automática, más visibilidad, más clientes)
- Tener un CTA claro: reservar 15 minutos de demo en https://socialcors.com
- Ser corto (5-7 líneas), directo y profesional
- NO usar palabras como "revolucionario", "increíble" o clichés de ventas

Responde SOLO con este JSON exacto:
{
  "subject": "Asunto del email (máx 60 caracteres, específico para el negocio)",
  "preview": "Primera línea visible del email (40 chars)",
  "body": "Cuerpo completo del email en texto plano con saltos de línea \\n"
}`;

  const result = await aiBinding.run("@cf/mistral/mistral-7b-instruct-v0.1", {
    messages: [{ role: "user", content: prompt }],
    max_tokens: 600,
    temperature: 0.6,
  }) as { response?: string };

  try {
    const raw = result.response ?? "";
    const jsonMatch = raw.match(/\{[\s\S]*\}/);
    if (!jsonMatch) return null;
    const parsed = JSON.parse(jsonMatch[0]) as { subject: string; body: string };

    const htmlBody = `
<!DOCTYPE html>
<html lang="es">
<head><meta charset="utf-8"><meta name="viewport" content="width=device-width,initial-scale=1"></head>
<body style="font-family:-apple-system,BlinkMacSystemFont,'Segoe UI',sans-serif;background:#f9fafb;margin:0;padding:40px 20px">
  <div style="max-width:560px;margin:0 auto;background:#fff;border-radius:16px;border:1px solid #e5e7eb;overflow:hidden">
    <div style="background:linear-gradient(135deg,#3b82f6,#06b6d4);padding:24px 32px">
      <img src="https://socialcors.com/logo-white.png" alt="Socialcors" style="height:32px" onerror="this.style.display='none'">
      <p style="color:white;font-size:12px;margin:8px 0 0;opacity:0.8">Gestión de redes con IA</p>
    </div>
    <div style="padding:32px">
      <div style="white-space:pre-line;font-size:15px;line-height:1.7;color:#374151">${parsed.body.replace(/</g, "&lt;").replace(/>/g, "&gt;")}</div>
      <div style="margin-top:28px">
        <a href="https://socialcors.com?utm_source=outreach&utm_medium=email&utm_campaign=prospect"
           style="display:inline-block;background:linear-gradient(135deg,#3b82f6,#06b6d4);color:white;text-decoration:none;padding:12px 28px;border-radius:10px;font-weight:700;font-size:14px">
          Ver demo de 15 minutos →
        </a>
      </div>
    </div>
    <div style="padding:16px 32px;border-top:1px solid #f3f4f6;background:#f9fafb">
      <p style="font-size:11px;color:#9ca3af;margin:0">
        Recibes este email porque ${prospect.businessName} podría beneficiarse de Socialcors.
        <a href="https://socialcors.com/unsubscribe" style="color:#6b7280">Desuscribirse</a>
      </p>
    </div>
  </div>
</body>
</html>`;

    return { subject: parsed.subject, htmlBody };
  } catch { return null; }
}

// ─── Entry point ─────────────────────────────────────────────────────────────

export async function sendProspectEmail(params: {
  prospect: SocialFlowProspect;
  senderName: string;
  brandName: string;
}): Promise<{ ok: boolean; code?: string }> {
  const { prospect, senderName, brandName } = params;

  if (!prospect.email) {
    return { ok: false, code: "NO_EMAIL_ON_PROSPECT" };
  }

  const content = await generateOutreachEmail(prospect, senderName, brandName);
  if (!content) {
    return { ok: false, code: "EMAIL_GENERATION_FAILED" };
  }

  const result = await sendEmail({
    to: prospect.email,
    subject: content.subject,
    html: content.htmlBody,
  });

  return result;
}

// ─── Follow-up email ──────────────────────────────────────────────────────────

export async function sendFollowUpEmail(params: {
  prospect: SocialFlowProspect;
  followUpNumber: number;
  senderName: string;
}): Promise<{ ok: boolean; code?: string }> {
  const { prospect, followUpNumber, senderName } = params;
  if (!prospect.email) return { ok: false, code: "NO_EMAIL_ON_PROSPECT" };

  const subjects = [
    `Re: ${prospect.businessName} y sus redes sociales`,
    `Último intento — ¿tiene sentido Socialcors para ${prospect.businessName}?`,
  ];
  const bodies = [
    `Hola,\n\nTe escribí hace unos días sobre cómo Socialcors podría ayudar a ${prospect.businessName} a publicar en redes automáticamente.\n\n¿Ha tenido ocasión de echarle un vistazo?\n\nSi le viene bien, agendamos una llamada de 15 minutos esta semana.\n\nSaludos,\n${senderName}`,
    `Hola,\n\nEs mi último mensaje para no molestar.\n\nSi en algún momento ${prospect.businessName} quiere externalizar las redes sociales a la IA, estaré encantado de mostrarle cómo lo hacemos en Socialcors.\n\nDemo gratuita en socialcors.com.\n\nSaludos,\n${senderName}`,
  ];

  const idx = Math.min(followUpNumber - 1, 1);
  const htmlBody = `<div style="font-family:sans-serif;max-width:560px;font-size:15px;line-height:1.7;color:#374151">
    <div style="white-space:pre-line">${bodies[idx]}</div>
    <div style="margin-top:20px">
      <a href="https://socialcors.com" style="background:#3b82f6;color:white;padding:10px 24px;border-radius:8px;text-decoration:none;font-weight:700">Agendar demo →</a>
    </div>
  </div>`;

  return sendEmail({ to: prospect.email, subject: subjects[idx], html: htmlBody });
}
