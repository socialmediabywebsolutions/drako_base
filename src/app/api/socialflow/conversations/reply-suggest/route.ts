import { requireCurrentSocialFlowSession } from "@/lib/socialflow/auth/request";
import { generateConversationalReply } from "@/lib/socialflow/conversational/engine";
import { getChannelKnowledge } from "@/lib/socialflow/profile/repository";
import type { ConversationThreadType } from "@/lib/socialflow/conversational/types";

export const dynamic = "force-dynamic";

// Temas que SIEMPRE debe derivar un humano — nunca deben llegar al motor de IA, ni
// siquiera como sugerencia editable. La IA (mock o real) no respeta de forma fiable
// instrucciones de "no hables de precio" dentro del system prompt, así que esto se
// detecta ANTES de llamar a generateConversationalReply(), no como una regla que se le
// pide seguir al LLM.
const BLOCKED_INTENT_PHRASES = [
  "precio", "precios", "tarifa", "tarifas", "presupuesto",
  "cuanto cobras", "cuanto cuesta", "cuanto vale", "cuanto me costaria",
  "contrato", "acuerdo", "exclusividad", "condiciones",
  "te pago", "pagarte", "te ofrezco", "oferta economica",
  "medico", "diagnostico", "enfermedad", "medicacion",
  "vida privada", "familia", "pareja", "relacion personal",
];

const BLOCKED_INTENT_REPLY =
  "¡Gracias por escribir! Este tipo de consultas las gestiona Sofía personalmente. Escríbele por DM a @sofiamarenfit o al email sofiamarenfit.socialcors@gmail.com y te responderá lo antes posible. 🙌";

// Case-insensitive y sin tildes: NFD + strip de marcas diacríticas reduce "cuánto",
// "médico", "diagnóstico" a su forma sin acento antes de comparar contra la lista de
// arriba (que ya está escrita sin tildes), así una sola entrada cubre ambas variantes.
function normalizeForBlockedIntentMatch(value: string): string {
  return value
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "")
    .toLowerCase();
}

function detectBlockedIntent(message: string): boolean {
  const normalized = normalizeForBlockedIntentMatch(message);
  return BLOCKED_INTENT_PHRASES.some((phrase) => normalized.includes(phrase));
}

export async function POST(request: Request) {
  try {
    const session = await requireCurrentSocialFlowSession(request);
    const body = (await request.json().catch(() => null)) as {
      message?: string;
      threadType?: string;
      saasId?: string;
    } | null;

    const message = body?.message?.trim();
    const threadType = (body?.threadType?.trim() || "DM") as ConversationThreadType;
    const saasId = body?.saasId?.trim() || "socialflow";

    if (!message) {
      return new Response(JSON.stringify({ error: "MISSING_MESSAGE" }), {
        status: 400,
        headers: { "content-type": "application/json" },
      });
    }

    // Gate de derivación a humano — se evalúa ANTES de tocar la IA (ni siquiera se
    // carga la Knowledge Base): precio/contrato/temas médicos/vida privada nunca deben
    // producir una sugerencia generada, aprobable con un clic desde el inbox.
    if (detectBlockedIntent(message)) {
      return new Response(
        JSON.stringify({
          ok: true,
          suggestedReply: BLOCKED_INTENT_REPLY,
          aiMetadata: { blockedIntent: true },
        }),
        { status: 200, headers: { "content-type": "application/json" } },
      );
    }

    const knowledge = await getChannelKnowledge(session.tenantId, saasId);
    const { suggestedReply, aiMetadata } = await generateConversationalReply({
      incomingMessage: message,
      threadType,
      profile: knowledge.profile,
      knowledge,
      tenantId: session.tenantId,
      saasId,
    });

    return new Response(JSON.stringify({ ok: true, suggestedReply, aiMetadata }), {
      status: 200,
      headers: { "content-type": "application/json" },
    });
  } catch (error) {
    if (error instanceof Error && error.message === "SESSION_REQUIRED") {
      return new Response(JSON.stringify({ error: "SESSION_REQUIRED" }), {
        status: 401,
        headers: { "content-type": "application/json" },
      });
    }
    console.error("SOCIALFLOW_REPLY_SUGGEST_ERROR", error instanceof Error ? error.message : "unknown");
    return new Response(JSON.stringify({ error: "REPLY_SUGGEST_FAILED" }), {
      status: 500,
      headers: { "content-type": "application/json" },
    });
  }
}
