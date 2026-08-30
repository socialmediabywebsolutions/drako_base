import { defaultLocalModel } from "../models/localModel";
import type { BrandProfile, ContentStrategy, StrategyItem } from "../types";

// Objetivo del cliente (BrandProfile.clientObjective) → formato — reemplaza la vieja
// alternancia i % 2 (carousel/reel) fija por día. followers/virality buscan máximo
// alcance (reel); engagement/saves/leads/sales se benefician más de contenido de
// autoridad que invita a guardar/interactuar (carousel). Sin objetivo reconocido, cae
// al mismo criterio de siempre (alternancia por índice de día) para no romper el
// comportamiento de clientes que todavía no configuraron uno — salvo que
// ContentDiversityAgent (vía SocialFlowOrchestrator) haya detectado que ese cliente
// lleva demasiados posts seguidos del mismo formato: en ese caso, en vez de alternar
// 50/50, se fuerza consistentemente el formato NO sobreusado. Un objetivo explícito del
// cliente (followers/virality/engagement/...) tiene prioridad sobre esta señal — es una
// decisión de negocio deliberada, no algo que la variedad deba pisar.
export function resolveFormatFromObjective(
  objective: string | null | undefined,
  fallbackIndex: number,
  avoidFormat?: "carousel" | "reel" | null,
): "carousel" | "reel" {
  switch (objective) {
    case "followers":
    case "virality":
      return "reel";
    case "engagement":
    case "saves":
    case "leads":
    case "sales":
      return "carousel";
    default:
      if (avoidFormat === "carousel") return "reel";
      if (avoidFormat === "reel") return "carousel";
      return fallbackIndex % 2 === 0 ? "carousel" : "reel";
  }
}

// Fallback used when Workers AI is unavailable or returns invalid JSON.
// Angles are topic-specific so even the fallback produces relevant content.
function buildBaseStrategy(horizonDays: number, niche: string, objective: string | null | undefined, avoidFormat?: "carousel" | "reel" | null): ContentStrategy {
  const pool: Array<{ theme: string; angle: string; callToAction: string }> = [
    {
      theme: "errores comunes",
      angle: `Los 3 errores más frecuentes en ${niche} que cuestan tiempo y dinero`,
      callToAction: "Comenta cuál de estos errores has cometido",
    },
    {
      theme: "guía práctica",
      angle: `Cómo mejorar tus resultados en ${niche} paso a paso`,
      callToAction: "Guarda este post para aplicarlo esta semana",
    },
    {
      theme: "tendencias",
      angle: `Lo que está cambiando en ${niche} y cómo adaptarte antes que la competencia`,
      callToAction: "Comparte con alguien de tu sector",
    },
    {
      theme: "caso de éxito",
      angle: `Cómo un cliente transformó su negocio gracias a una estrategia de ${niche}`,
      callToAction: "Escríbenos si quieres un caso de éxito como este",
    },
    {
      theme: "mitos vs realidad",
      angle: `Lo que crees saber sobre ${niche} (y lo que realmente funciona)`,
      callToAction: "Etiqueta a alguien que necesita leer esto",
    },
    {
      theme: "tips rápidos",
      angle: `5 acciones concretas para destacar en ${niche} sin grandes presupuestos`,
      callToAction: "Guarda este post y aplica uno hoy",
    },
    {
      theme: "estrategia avanzada",
      angle: `La estrategia que usan los líderes de ${niche} que nadie más explica`,
      callToAction: "Agenda una llamada para implementar esto en tu negocio",
    },
  ];

  const items: StrategyItem[] = [];
  for (let i = 0; i < horizonDays; i++) {
    const entry = pool[i % pool.length];
    items.push({
      id: `day_${i + 1}`,
      dayOffset: i,
      theme: entry.theme,
      angle: entry.angle,
      format: resolveFormatFromObjective(objective, i, avoidFormat),
      callToAction: entry.callToAction,
    });
  }
  return { horizonDays, items };
}

// Only include profile lines that carry real information beyond the niche placeholder.
function profileContext(profile: BrandProfile): string {
  const lines: string[] = [];
  if (profile.audience && profile.audience !== `${profile.niche} buyers`) lines.push(`Audiencia: ${profile.audience}.`);
  if (profile.buyerPersona && profile.buyerPersona !== `${profile.niche} operator`) lines.push(`Buyer persona: ${profile.buyerPersona}.`);
  if (profile.mission && !profile.mission.includes("Grow")) lines.push(`Misión: ${profile.mission}.`);
  if (profile.valueProposition && !profile.valueProposition.startsWith(profile.niche)) lines.push(`Propuesta de valor: ${profile.valueProposition}.`);
  const services = profile.services.filter(Boolean);
  if (services.length) lines.push(`Servicios: ${services.join(", ")}.`);
  const offers = profile.offers.filter(Boolean);
  if (offers.length) lines.push(`Ofertas: ${offers.join(", ")}.`);
  const pains = profile.painPoints.filter(p => p && p !== profile.niche);
  if (pains.length) lines.push(`Puntos de dolor: ${pains.join(", ")}.`);
  const desires = profile.desires.filter(d => d && d !== "growth");
  if (desires.length) lines.push(`Deseos del cliente: ${desires.join(", ")}.`);
  const forbidden = profile.forbiddenTopics.filter(Boolean);
  if (forbidden.length) lines.push(`Temas prohibidos: ${forbidden.join(", ")}.`);
  const ctx = profile.longDescription.replace(`${profile.niche} content pipeline`, "").trim();
  if (ctx) lines.push(`Contexto adicional: ${ctx}`);
  return lines.join("\n");
}

export class StrategyAgent {
  async run(input: {
    profile: BrandProfile;
    horizonDays: number;
    // Formato que ContentDiversityAgent detectó sobreusado (vía SocialFlowOrchestrator,
    // socialcors_content_diversity) — resuelto por el caller, no leído aquí: este
    // agente se mantiene sin I/O propio para esa señal, mismo criterio que
    // optimalHoursByFormat/preferredWeekdays en SchedulerAgent. Solo afecta la rama sin
    // objetivo configurado (ver resolveFormatFromObjective).
    avoidFormat?: "carousel" | "reel" | null;
  }): Promise<ContentStrategy> {
    const { profile, horizonDays, avoidFormat } = input;

    const extra = profileContext(profile);

    // Mismo cálculo que buildBaseStrategy (resolveFormatFromObjective) para que el
    // formato que termine persistido no dependa de si respondió el LLM o si se cayó al
    // fallback determinista — ambos caminos usan exactamente los mismos valores.
    const formatByDay = Array.from({ length: horizonDays }, (_, i) =>
      resolveFormatFromObjective(profile.clientObjective, i, avoidFormat),
    );
    const formatInstructions = formatByDay.map((f, i) => `Día ${i + 1}: "${f}"`).join("\n");

    const prompt = `Diseña una estrategia de ${horizonDays} posts de redes sociales EN ESPAÑOL.

TEMA CENTRAL (prioridad máxima): "${profile.niche}"
Todos los posts deben girar en torno a "${profile.niche}". Cada ángulo, ejemplo y CTA debe ser específico de este tema. Prohibido contenido genérico de marketing.

Marca: ${profile.brandIdentity}.
Tono: ${profile.toneOfVoice}.
${extra}

Requisitos por post:
- theme: categoría del contenido (ej. "tips prácticos", "caso de éxito", "mito vs realidad", "tendencias", "errores comunes")
- angle: ángulo concreto y específico sobre "${profile.niche}" — no genérico, con detalle real del tema
- callToAction: CTA que invite a comentar, compartir o actuar en relación con "${profile.niche}"
- format: usa EXACTAMENTE el formato indicado para cada día en esta lista (no elijas libremente):
${formatInstructions}

Varía los ángulos: no repitas el mismo enfoque dos veces seguidas. Mezcla educación, inspiración, casos de uso y análisis, siempre sobre "${profile.niche}".`;

    const base = buildBaseStrategy(horizonDays, profile.niche, profile.clientObjective, avoidFormat);

    const { data } = await defaultLocalModel.generateStructured<ContentStrategy>(
      { prompt },
      () => base,
    );

    return data;
  }
}
