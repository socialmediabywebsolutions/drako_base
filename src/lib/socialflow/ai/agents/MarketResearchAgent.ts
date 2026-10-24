import { defaultLocalModel } from "../models/localModel";
import { env } from "@/lib/cf";
import { getNicheIntelligence, type NicheIntelligence } from "@/lib/socialflow/intelligence/NicheIntelligenceService";
import type { BrandProfile, MarketResearch } from "../types";

type MarketResearchAccountType = "influencer" | "empresa";

const ACCOUNT_TYPE_FOCUS: Record<MarketResearchAccountType, string> = {
  influencer: "Enfócate en tendencias de contenido, nichos adyacentes que este creador podría explorar, y oportunidades de colaboración con otros creadores.",
  empresa: "Enfócate en competencia local real, diferenciación frente a otros negocios del sector, y oportunidades de mercado concretas para captar clientes.",
};

// generateStructured() decorates su resultado con _meta.engine — "workers-ai" en una
// respuesta real, "local-deterministic-stub" ante cualquier fallo (ver
// WorkersAiLocalModel.generateStructured). Mismo criterio que el resto del Cerebro:
// nunca confiar en el seed vacío como si fuera un análisis real.
type MarketResearchResult = MarketResearch & { _meta?: { engine?: string } };

// Fallback honesto — si no hay datos reales de nicho, lo dice en vez de fingir una
// tendencia concreta que no puede respaldar.
function buildFallback(niche: string, hasRealNicheData: boolean): MarketResearch {
  return {
    trends: hasRealNicheData
      ? [
          `Sigue de cerca las tendencias actuales de ${niche} para mantener el contenido relevante.`,
          "El contenido de proceso/detrás de cámaras suele generar interés real en la audiencia.",
        ]
      : [
          `Todavía no hay datos reales de tendencia para "${niche}" en el Cerebro — este análisis es general, no específico de esta semana.`,
          "El contenido de proceso/detrás de cámaras suele generar interés en la mayoría de nichos.",
        ],
    competitors: ["Competidores locales/directos", "Referentes del sector", "Marcas o creadores con audiencia similar"],
    contentGaps: [
      "Contenido educativo que explique precios o procesos con transparencia.",
      "Contenido sobre resultados a largo plazo y fidelización, no solo la primera venta.",
    ],
  };
}

function buildPrompt(input: {
  profile: BrandProfile;
  accountType: MarketResearchAccountType;
  nicheIntel: NicheIntelligence | null;
}): string {
  const { profile, accountType, nicheIntel } = input;

  const nicheBlock = nicheIntel
    ? [
        "Datos reales de tendencia en este nicho ahora mismo (nunca inventes cifras adicionales, usa solo esto):",
        nicheIntel.hashtags.length ? `- Hashtags en tendencia: ${nicheIntel.hashtags.slice(0, 10).join(" ")}` : "",
        nicheIntel.formats.length ? `- Formatos que están funcionando: ${nicheIntel.formats.join(", ")}` : "",
        nicheIntel.hooks.length ? `- Hooks que están funcionando: ${nicheIntel.hooks.slice(0, 5).join(" | ")}` : "",
      ].filter(Boolean).join("\n")
    : "No hay datos reales de tendencia disponibles todavía para este nicho — sé honesto sobre esa limitación en tu análisis (no inventes cifras ni tendencias específicas de esta semana) y da un análisis más general basado en el nicho y la audiencia descritos abajo.";

  return `Eres un analista de mercado especializado en el nicho "${profile.niche}" para redes sociales en español.
Audiencia: ${profile.audience}
Servicios/productos: ${profile.services.join(", ") || "no especificado"}

${nicheBlock}

${ACCOUNT_TYPE_FOCUS[accountType]}

Responde SOLO con un objeto JSON válido, sin markdown ni backticks, con esta forma exacta:
{
  "trends": ["3-4 tendencias del nicho, en español"],
  "competitors": ["3-4 tipos de competidores relevantes, en español"],
  "contentGaps": ["2-3 huecos de contenido que este cliente podría aprovechar, en español"]
}
Nunca inventes cifras concretas (porcentajes, número de seguidores, etc.) que no te haya dado arriba.`;
}

export class MarketResearchAgent {
  async run(input: { profile: BrandProfile; tenantId?: string; saasId?: string }): Promise<MarketResearch> {
    const { profile } = input;
    const accountType: MarketResearchAccountType = profile.accountType ?? "influencer";

    const dracoEnv = env();
    const nicheIntel =
      dracoEnv && input.tenantId && input.saasId
        ? await getNicheIntelligence(profile.niche, dracoEnv, input.tenantId, input.saasId, accountType).catch(() => null)
        : null;

    const fallback = buildFallback(profile.niche, Boolean(nicheIntel));

    const { data } = await defaultLocalModel.generateStructured<MarketResearchResult>(
      { prompt: buildPrompt({ profile, accountType, nicheIntel }), tenantId: input.tenantId, saasId: input.saasId },
      () => fallback as MarketResearchResult,
    );

    if (data._meta?.engine !== "workers-ai") return fallback;

    return {
      trends: Array.isArray(data.trends) && data.trends.length ? data.trends : fallback.trends,
      competitors: Array.isArray(data.competitors) && data.competitors.length ? data.competitors : fallback.competitors,
      contentGaps: Array.isArray(data.contentGaps) && data.contentGaps.length ? data.contentGaps : fallback.contentGaps,
    };
  }
}
