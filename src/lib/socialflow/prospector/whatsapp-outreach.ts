/**
 * WhatsAppOutreachAgent — Mensajes de prospección via WhatsApp Business API
 *
 * WhatsApp limita los mensajes a no-contactos a "template messages"
 * aprobadas por Meta. Este agente genera el texto y lo envía a través
 * del WhatsAppService existente.
 *
 * Para un primer contacto en frío, se usa el enlace wa.me directo
 * que el prospecto puede abrir desde el email (no requiere template aprobada).
 */

import { env } from "@/lib/cf";
import type { SocialFlowProspect } from "./types";

// ─── Generación de mensaje WhatsApp ──────────────────────────────────────────

async function generateWhatsAppMessage(prospect: SocialFlowProspect, senderName: string): Promise<string | null> {
  const bindings = env() as Record<string, unknown> | null;
  const aiBinding = bindings?.AI as { run: (model: string, opts: unknown) => Promise<unknown> } | null;
  if (!aiBinding) return buildDefaultMessage(prospect, senderName);

  const prompt = `Escribe un mensaje de WhatsApp de prospección en español para este negocio:

Negocio: ${prospect.businessName}
Sector: ${prospect.niche}
Ubicación: ${prospect.location}
${prospect.description ? `Descripción: ${prospect.description}` : ""}

El mensaje debe:
- Ser muy breve (3-4 líneas máximo)
- Presentar a ${senderName} de Socialcors
- Mencionar que automatiza sus redes con IA
- Terminar con una pregunta sencilla (¿le interesa ver cómo?)
- Tono cercano pero profesional, en español

Responde SOLO con el texto del mensaje, sin comillas ni formato extra.`;

  const result = await aiBinding.run("@cf/mistral/mistral-7b-instruct-v0.1", {
    messages: [{ role: "user", content: prompt }],
    max_tokens: 200,
    temperature: 0.6,
  }) as { response?: string };

  const text = result.response?.trim();
  return text || buildDefaultMessage(prospect, senderName);
}

function buildDefaultMessage(prospect: SocialFlowProspect, senderName: string): string {
  return `Hola, soy ${senderName} de Socialcors.

Vi ${prospect.businessName} y pensé que podría interesaros: automatizamos las redes sociales de negocios como el vuestro con IA — Instagram, LinkedIn, Facebook — sin que tengáis que hacer nada.

¿Os interesa que os lo muestre en 15 minutos? 🙌`;
}

// ─── Envío via WhatsApp Business API ─────────────────────────────────────────

async function sendViaMetaApi(phone: string, message: string, apiKey: string, phoneNumberId: string): Promise<{ ok: boolean; code?: string }> {
  const normalizedPhone = phone.replace(/[\s\-\(\)]/g, "").replace(/^\+/, "");
  const url = `https://graph.facebook.com/v18.0/${phoneNumberId}/messages`;

  const res = await fetch(url, {
    method: "POST",
    headers: {
      Authorization: `Bearer ${apiKey}`,
      "Content-Type": "application/json",
    },
    body: JSON.stringify({
      messaging_product: "whatsapp",
      to: normalizedPhone,
      type: "text",
      text: { body: message },
    }),
  });

  if (!res.ok) {
    const body = await res.text().catch(() => "");
    console.error("[WhatsApp Prospector] Meta API error", res.status, body);
    return { ok: false, code: "WHATSAPP_SEND_FAILED" };
  }
  return { ok: true };
}

// ─── Entry point ─────────────────────────────────────────────────────────────

export async function sendProspectWhatsApp(params: {
  prospect: SocialFlowProspect;
  senderName: string;
}): Promise<{ ok: boolean; code?: string; waLink?: string }> {
  const { prospect, senderName } = params;

  const phone = prospect.whatsapp ?? prospect.phone;
  if (!phone) return { ok: false, code: "NO_PHONE_ON_PROSPECT" };

  const message = await generateWhatsAppMessage(prospect, senderName);
  if (!message) return { ok: false, code: "WA_GENERATION_FAILED" };

  const bindings = env() as Record<string, unknown> | null;
  const waApiKey = typeof bindings?.WHATSAPP_API_KEY === "string" ? bindings.WHATSAPP_API_KEY : null;
  const waPhoneId = typeof bindings?.WHATSAPP_PHONE_NUMBER_ID === "string" ? bindings.WHATSAPP_PHONE_NUMBER_ID : null;

  // Si la API de WhatsApp está configurada, enviar directamente
  if (waApiKey && waPhoneId) {
    return sendViaMetaApi(phone, message, waApiKey, waPhoneId);
  }

  // Fallback: generar link wa.me para que el operador lo envíe manualmente
  const normalizedPhone = phone.replace(/[\s\-\(\)]/g, "").replace(/^\+/, "");
  const encodedMessage = encodeURIComponent(message);
  const waLink = `https://wa.me/${normalizedPhone}?text=${encodedMessage}`;

  return { ok: true, code: "WA_LINK_ONLY", waLink };
}

export async function buildWhatsAppLink(prospect: SocialFlowProspect, senderName: string): Promise<string | null> {
  const phone = prospect.whatsapp ?? prospect.phone;
  if (!phone) return null;
  const message = await generateWhatsAppMessage(prospect, senderName);
  if (!message) return null;
  const normalized = phone.replace(/[\s\-\(\)]/g, "").replace(/^\+/, "");
  return `https://wa.me/${normalized}?text=${encodeURIComponent(message)}`;
}
