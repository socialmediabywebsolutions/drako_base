import { sendEmail } from "@/lib/email";
import { getChannelProfile } from "@/lib/socialflow/profile/repository";
import type { LeadTemperature } from "./types";

function escapeHtml(text: string): string {
  return text.replace(/&/g, "&amp;").replace(/</g, "&lt;").replace(/>/g, "&gt;");
}

export type NotifyTenantOfNewLeadParams = {
  tenantId: string;
  saasId: string;
  temperature: LeadTemperature;
  incomingMessage: string;
  intentScore: number;
};

// Se llama justo después de createLead() en cada punto donde el clasificador de
// intención (leads/detector.ts) marca un mensaje como lead — cron de comentarios e
// inbound/route.ts (DMs). Solo WARM/HOT notifican por email: COLD sigue creando el
// lead en la DB (comportamiento previo sin cambios) pero no dispara ruido al dueño.
// Nunca lanza — un email fallido no debe tumbar el flujo de ingesta del hilo/lead que
// ya se completó antes de llamar a esto.
export async function notifyTenantOfNewLead(params: NotifyTenantOfNewLeadParams): Promise<void> {
  if (params.temperature !== "WARM" && params.temperature !== "HOT") return;

  try {
    const profile = await getChannelProfile(params.tenantId, params.saasId);
    const email = profile.contactEmail?.trim();
    if (!email || !email.includes("@")) {
      console.warn("[leads/notify] no contact email on file, skipping lead notification", params.tenantId, params.saasId);
      return;
    }

    const tenantName = profile.brandName?.trim() || profile.channelName?.trim() || "tu cuenta";
    const niche = profile.niche?.trim() || "tu nicho";
    const messagePreview = params.incomingMessage.slice(0, 500);

    const result = await sendEmail({
      to: email,
      subject: `🔥 Nuevo lead en ${tenantName} — ${niche}`,
      html: `<p>Alguien está interesado en tus servicios. Mensaje recibido: "${escapeHtml(messagePreview)}". Intención detectada: ${params.intentScore}/100. Revisa el CRM Social en <a href="https://socialcors.com">socialcors.com</a></p>`,
    });

    if (!result.ok) {
      console.error("[leads/notify] sendEmail failed", params.tenantId, params.saasId, result.code);
    }
  } catch (err) {
    console.error("[leads/notify] failed to notify tenant of new lead", params.tenantId, params.saasId, err instanceof Error ? err.message : String(err));
  }
}
