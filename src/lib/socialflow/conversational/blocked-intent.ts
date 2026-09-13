// Temas que SIEMPRE debe derivar un humano — nunca deben llegar al motor de IA, ni
// siquiera como sugerencia editable. La IA (mock o real) no respeta de forma fiable
// instrucciones de "no hables de precio" dentro del system prompt, así que esto se
// detecta ANTES de llamar a generateConversationalReply(), no como una regla que se le
// pide seguir al LLM. Compartido entre el endpoint de cliente
// (conversations/reply-suggest/route.ts) y el probador del panel de operador
// (api/operator/socialflow/route.ts, acción "test_ai_reply") — una sola lista, no dos
// copias que puedan desincronizarse.
const BLOCKED_INTENT_PHRASES = [
  "precio", "precios", "tarifa", "tarifas", "presupuesto",
  "cuanto cobras", "cuanto cuesta", "cuanto vale", "cuanto me costaria",
  "contrato", "acuerdo", "exclusividad", "condiciones",
  "te pago", "pagarte", "te ofrezco", "oferta economica",
  "medico", "diagnostico", "enfermedad", "medicacion",
  "vida privada", "familia", "pareja", "relacion personal",
];

export const BLOCKED_INTENT_REPLY =
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

export function detectBlockedIntent(message: string): boolean {
  const normalized = normalizeForBlockedIntentMatch(message);
  return BLOCKED_INTENT_PHRASES.some((phrase) => normalized.includes(phrase));
}
