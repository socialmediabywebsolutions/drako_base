import type { SocialFlowClientObjective } from "../types";

// CTA fijo por objetivo del cliente (BrandProfile.clientObjective, configurado una vez
// en el perfil) — mismo criterio en todos los formatos (Carrusel, Post, Reel, Historia):
// frases ya decididas, nunca redactadas por la IA, para que el objetivo configurado se
// refleje siempre igual sin importar qué agente/prompt genere el texto alrededor.
// Extraído de CarouselComposerAgent.ts (Fase 0 Carrusel) para reutilizarlo también en
// ContentGeneratorAgent/OptimizationAgent (Post/Reel/Historia).
export const CTA_BY_OBJECTIVE: Record<SocialFlowClientObjective, string> = {
  followers: "Sígueme para más contenido como este 👉 {handle}",
  engagement: "¿Cuál vas a aplicar hoy? Cuéntame 👇",
  leads: "Escríbeme por DM y te explico cómo empezar 💬",
  sales: "Link en bio para conseguirlo 🛒",
  saves: "Guarda esto para cuando lo necesites 🔖",
};

// objective/handle sueltos en vez de BrandProfile completo — desacopla este util del
// tipo de perfil, cualquier caller que tenga esos dos valores puede usarlo sin importar
// el objeto entero.
export function resolveObjectiveCta(
  objective: SocialFlowClientObjective | null | undefined,
  handle: string | null | undefined,
): string | null {
  if (!objective) return null;
  return CTA_BY_OBJECTIVE[objective].replace("{handle}", handle || "");
}
