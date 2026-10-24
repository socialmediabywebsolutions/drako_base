export type MonetizationSuggestionType = "subscription" | "one_time" | "booking";

export type MonetizationSuggestion = {
  name: string;
  description: string;
  // Rango de texto libre (ej. "19-39€/mes") en vez de un número — un precio único
  // inventado por la IA sería más fácil de confundir con un dato real; un rango deja
  // claro que es una sugerencia orientativa, no un precio fijado.
  priceRange: string;
  type: MonetizationSuggestionType;
};

export const MONETIZATION_TYPE_LABELS: Record<MonetizationSuggestionType, string> = {
  subscription: "Suscripción mensual",
  one_time: "Pago único",
  booking: "Reserva",
};

// Fallback determinista — mismo criterio que buildFallbackViralThemes en
// ai/chat/route.ts: si Workers AI no está disponible o la respuesta no parsea, el
// usuario nunca se queda sin sugerencias, solo con unas más genéricas.
export function buildFallbackMonetizationSuggestions(niche: string): MonetizationSuggestion[] {
  const nicheLabel = niche || "tu nicho";
  return [
    {
      name: "Asesoría personalizada 1:1",
      description: `Sesión individual para resolver dudas concretas sobre ${nicheLabel} y marcar un plan de acción.`,
      priceRange: "29-49€/sesión",
      type: "booking",
    },
    {
      name: "Plan mensual con seguimiento",
      description: `Acceso a contenido exclusivo y revisión mensual de tu progreso en ${nicheLabel}.`,
      priceRange: "19-39€/mes",
      type: "subscription",
    },
    {
      name: "Guía descargable",
      description: `Recurso descargable con lo esencial para empezar en ${nicheLabel}, sin acompañamiento continuo.`,
      priceRange: "9-19€",
      type: "one_time",
    },
  ];
}

export function parseMonetizationSuggestions(raw: string): MonetizationSuggestion[] | null {
  const jsonMatch = raw.match(/\{[\s\S]*\}/);
  if (!jsonMatch) return null;
  try {
    const parsed = JSON.parse(jsonMatch[0]) as { servicios?: unknown };
    if (!Array.isArray(parsed.servicios)) return null;

    const suggestions: MonetizationSuggestion[] = [];
    for (const rawService of parsed.servicios) {
      if (!rawService || typeof rawService !== "object") continue;
      const s = rawService as Record<string, unknown>;
      const type = s.tipo;
      if (
        typeof s.nombre !== "string" || !s.nombre.trim()
        || typeof s.descripcion !== "string" || !s.descripcion.trim()
        || typeof s.precio !== "string" || !s.precio.trim()
        || (type !== "subscription" && type !== "one_time" && type !== "booking")
      ) {
        continue;
      }
      suggestions.push({
        name: s.nombre.trim(),
        description: s.descripcion.trim(),
        priceRange: s.precio.trim(),
        type,
      });
      if (suggestions.length === 5) break;
    }
    return suggestions.length >= 3 ? suggestions : null;
  } catch {
    return null;
  }
}
