import { requireCurrentSocialFlowSession } from "@/lib/socialflow/auth/request";
import { getChannelKnowledge } from "@/lib/socialflow/profile/repository";
import { getKnowledgeContext } from "@/lib/socialflow/knowledge/repository";
import {
  buildFallbackMonetizationSuggestions,
  parseMonetizationSuggestions,
} from "@/lib/socialflow/profile/monetization-suggestions";
import { env } from "@/lib/cf";

export const dynamic = "force-dynamic";

export async function POST(request: Request) {
  try {
    const session = await requireCurrentSocialFlowSession(request);
    const body = (await request.json().catch(() => null)) as { saasId?: string } | null;
    const saasId = body?.saasId?.trim() || "socialflow";

    const [knowledge, knowledgeContext] = await Promise.all([
      getChannelKnowledge(session.tenantId, saasId),
      getKnowledgeContext(session.tenantId, saasId).catch(() => ""),
    ]);

    const profile = knowledge.profile;
    const niche = profile.niche?.trim() || profile.brandName?.trim() || "";
    const dracoEnv = env();

    if (dracoEnv?.AI) {
      try {
        const existingServices = [...(profile.services ?? []), ...(profile.offers ?? [])].filter(Boolean);
        const existingLine = existingServices.length
          ? `Servicios que ya ofrece (NO los repitas, sugiere alternativas complementarias): ${existingServices.join(", ")}.`
          : "";
        const audienceLine = profile.audienceDescription ? `Audiencia: ${profile.audienceDescription}.` : "";
        const kbLine = knowledgeContext ? `Contexto real del negocio (documentos de conocimiento):\n${knowledgeContext.slice(0, 1500)}` : "";

        const prompt = `Eres un consultor de monetización para creadores de contenido e influencers. Nicho: "${niche || "sin especificar"}".
${audienceLine}
${existingLine}
${kbLine}

Propón entre 3 y 5 servicios monetizables REALISTAS para este nicho — cosas que un cliente real pagaría, con precios coherentes con el mercado hispanohablante (España/Latinoamérica) para una cuenta de tamaño pequeño-mediano (no precios de celebridad).

Responde SOLO con JSON válido, sin markdown, con esta forma exacta:
{"servicios": [{"nombre": "...", "descripcion": "...", "precio": "19-39€/mes", "tipo": "subscription"|"one_time"|"booking"}]}

Reglas:
- "descripcion": una frase breve (máx. 20 palabras), en español.
- "precio": un rango de texto realista con la moneda, ej. "29€/mes" o "15-25€".
- "tipo": "subscription" (pago recurrente), "one_time" (pago único) o "booking" (reserva de sesión/cita).
- Nunca inventes servicios genéricos sin relación con el nicho.`;

        const result = (await dracoEnv.AI.run("@cf/meta/llama-3.1-70b-instruct", {
          messages: [{ role: "user", content: prompt }],
        })) as { response?: string };

        const parsed = parseMonetizationSuggestions(result?.response?.trim() ?? "");
        if (parsed) {
          return new Response(JSON.stringify({ ok: true, suggestions: parsed }), {
            status: 200,
            headers: { "content-type": "application/json" },
          });
        }
      } catch {
        // cae al fallback determinista de abajo — nunca deja al cliente sin sugerencias
      }
    }

    return new Response(JSON.stringify({ ok: true, suggestions: buildFallbackMonetizationSuggestions(niche) }), {
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
    console.error("SOCIALFLOW_MONETIZATION_SUGGESTIONS_ERROR", error instanceof Error ? error.message : "unknown");
    return new Response(JSON.stringify({ error: "MONETIZATION_SUGGESTIONS_FAILED" }), {
      status: 500,
      headers: { "content-type": "application/json" },
    });
  }
}
