import { sendEmail } from "@/lib/socialflow/platform/email";
import { getChannelProfile } from "@/lib/socialflow/profile/repository";

function escapeHtml(text: string): string {
  return text.replace(/&/g, "&amp;").replace(/</g, "&lt;").replace(/>/g, "&gt;");
}

export type NotifyTenantOfImageFailureParams = {
  tenantId: string;
  saasId: string;
  postId: string;
  postTitle: string;
};

// Se llama desde SocialFlowOrchestrator.persistToDb() justo después de guardar un post
// de Instagram en DRAFT con metadata.error_message = IMAGE_GENERATION_FAILED —
// TrendAutoApproveCron no lo aprueba y, sin este aviso, se quedaba sin publicar sin
// que nadie se enterara. Mismo patrón que leads/notify.ts: nunca lanza, un email
// fallido no debe tumbar la persistencia del resto de posts de la campaña.
export async function notifyTenantOfImageFailure(params: NotifyTenantOfImageFailureParams): Promise<void> {
  try {
    const profile = await getChannelProfile(params.tenantId, params.saasId);
    const email = profile.contactEmail?.trim();
    if (!email || !email.includes("@")) {
      console.warn("[posts/notify] no contact email on file, skipping image failure notification", params.tenantId, params.saasId, params.postId);
      return;
    }

    const brandName = profile.brandName?.trim() || profile.channelName?.trim() || "tu cuenta";
    const postTitle = params.postTitle.trim() || "sin título";

    const result = await sendEmail({
      to: email,
      subject: `⚠️ Un post no pudo generar imagen — ${brandName}`,
      html: `<p>El post "${escapeHtml(postTitle)}" no pudo generar su imagen automáticamente, así que se ha quedado en borrador y no se publicará hasta que tenga una.</p><p>Puedes entrar en <a href="https://socialcors.com">socialcors.com</a> para añadir una imagen manualmente o regenerarla: <a href="https://socialcors.com/workspace/ai">https://socialcors.com/workspace/ai</a></p>`,
    });

    if (!result.ok) {
      console.error("[posts/notify] sendEmail failed", params.tenantId, params.saasId, params.postId, result.code);
    }
  } catch (err) {
    console.error("[posts/notify] failed to notify tenant of image failure", params.tenantId, params.saasId, params.postId, err instanceof Error ? err.message : String(err));
  }
}
