import { intelligenceModel } from "@/lib/socialflow/ai/models/anthropicModel";
import type { ChannelCompetitor, ChannelProfile } from "@/lib/socialflow/profile/types";
import type { AuditAreaScore, AuditCompetitorComparison, AuditRecommendation } from "@/lib/socialflow/audit/types";

type AuditMetrics = {
  impressions: number;
  likes: number;
  comments: number;
  shares: number;
  engagement: number;
  publishedPosts: number;
  followersCount?: number;
};

type AuditEngineInput = {
  profile: ChannelProfile;
  competitors: ChannelCompetitor[];
  metrics?: AuditMetrics | null;
  tenantId?: string;
  saasId?: string;
};

type AuditBase = {
  score: number;
  areaScores: AuditAreaScore[];
  strengths: string[];
  weaknesses: string[];
  opportunities: string[];
  recommendations: AuditRecommendation[];
  competitorComparison: AuditCompetitorComparison[];
  summary: string;
};

function filled(value: string | null | undefined): boolean {
  return Boolean(value && value.trim().length > 0);
}

function nonEmptyList(value: string[] | null | undefined): boolean {
  return Array.isArray(value) && value.length > 0;
}

function parsePercent(value: string | null | undefined): number | null {
  if (!value) return null;
  const match = value.match(/-?\d+(\.\d+)?/);
  if (!match) return null;
  const num = Number(match[0]);
  return Number.isFinite(num) ? num : null;
}

function scoreBrandIdentity(profile: ChannelProfile): AuditAreaScore {
  const checks = [
    filled(profile.brandName),
    filled(profile.shortDescription),
    filled(profile.toneOfVoice),
    filled(profile.niche),
    nonEmptyList(profile.differentiators),
  ];
  const score = Math.round((checks.filter(Boolean).length / checks.length) * 100);
  const notes = score >= 70
    ? "La identidad de marca esta bien definida: nombre, tono y nicho son claros."
    : "Ve a Mi Perfil y completa nombre de marca, tono de voz y diferenciadores. Sin esto, el Cerebro no puede generar contenido con tu identidad real.";
  return { area: "Identidad de marca", score, notes };
}

function scoreAudienceClarity(profile: ChannelProfile): AuditAreaScore {
  const checks = [
    filled(profile.audienceDescription),
    filled(profile.buyerPersona),
    nonEmptyList(profile.painPoints),
    nonEmptyList(profile.desires),
  ];
  const score = Math.round((checks.filter(Boolean).length / checks.length) * 100);
  const notes = score >= 70
    ? "El publico objetivo esta bien segmentado y entendido."
    : "Ve a Mi Perfil → Audiencia y rellena los campos de buyer persona. Cuanto mas detalle, mejor contenido genera el Cerebro.";
  return { area: "Audiencia y publico objetivo", score, notes };
}

function scoreContentStrategy(profile: ChannelProfile): AuditAreaScore {
  const checks = [
    nonEmptyList(profile.contentPillars),
    nonEmptyList(profile.mainTopics),
    nonEmptyList(profile.preferredFormats),
    filled(profile.postingFrequencyGoal),
  ];
  const score = Math.round((checks.filter(Boolean).length / checks.length) * 100);
  const notes = score >= 70
    ? "Existe una base de pilares de contenido y formatos preferidos."
    : "Ve a Mi Perfil y define tus pilares de contenido, temas principales y formatos preferidos para que el Cerebro sepa sobre que escribir.";
  return { area: "Estrategia de contenido", score, notes };
}

function scoreSocialPresence(profile: ChannelProfile): AuditAreaScore {
  const networkCount = profile.activeSocialNetworks?.length ?? 0;
  const checks = [networkCount >= 1, networkCount >= 2, networkCount >= 3, filled(profile.websiteUrl)];
  const score = Math.round((checks.filter(Boolean).length / checks.length) * 100);
  const notes = networkCount === 0
    ? "Ve a Conectar redes y vincula al menos una cuenta de Instagram o LinkedIn para poder publicar."
    : `Presencia activa en ${networkCount} red(es) social(es).`;
  return { area: "Presencia en redes sociales", score, notes };
}

function scoreCompetitivePositioning(profile: ChannelProfile, competitors: ChannelCompetitor[]): AuditAreaScore {
  const checks = [
    competitors.length >= 1,
    competitors.length >= 3,
    nonEmptyList(profile.differentiators),
    nonEmptyList(profile.opportunitySignals),
  ];
  const score = Math.round((checks.filter(Boolean).length / checks.length) * 100);
  const notes = competitors.length >= 3
    ? `Se han identificado ${competitors.length} competidores para comparar.`
    : "Se necesitan mas competidores mapeados para una comparativa solida.";
  return { area: "Posicionamiento competitivo", score, notes };
}

function howStepsForArea(area: string): string[] {
  const key = area.toLowerCase();
  if (key.includes("identidad")) {
    return [
      "Ve a Mi Perfil → Identidad de marca.",
      "Completa nombre, tono de voz, nicho y diferenciadores con datos reales de tu negocio.",
      "Guarda y regenera la auditoría para confirmar la mejora.",
    ];
  }
  if (key.includes("audiencia")) {
    return [
      "Ve a Mi Perfil → Audiencia.",
      "Define el buyer persona, dolores y deseos de tu público objetivo.",
      "Cuanto más detalle aportes, mejor podrá segmentar el Cerebro el contenido.",
    ];
  }
  if (key.includes("estrategia") || key.includes("contenido")) {
    return [
      "Ve a Mi Perfil → Estrategia de contenido.",
      "Define tus pilares de contenido, temas principales y formatos preferidos.",
      "Fija una frecuencia de publicación objetivo realista.",
    ];
  }
  if (key.includes("presencia")) {
    return [
      "Ve a Conectar redes.",
      "Vincula al menos una cuenta de Instagram o LinkedIn activa.",
      "Verifica que la conexión quede en estado activo antes de publicar.",
    ];
  }
  if (key.includes("competitiv")) {
    return [
      "Ve a Mi Perfil → Competidores.",
      "Añade al menos 3 competidores relevantes de tu nicho con su usuario o página.",
      "Revisa sus formatos y frecuencia para detectar oportunidades.",
    ];
  }
  if (key.includes("rendimiento") || key.includes("real")) {
    return [
      "Publica con mayor frecuencia para generar más datos reales.",
      "Revisa qué formatos generan más impresiones y engagement.",
      "Ajusta tu calendario de contenido según lo que mejor funcione.",
    ];
  }
  return [
    "Revisa este apartado en Mi Perfil.",
    "Actualiza la información con datos reales y específicos.",
    "Regenera la auditoría para verificar la mejora.",
  ];
}

function scoreEngagementMetrics(metrics: AuditMetrics | null | undefined): AuditAreaScore | null {
  if (!metrics) return null;
  const { impressions, engagement, publishedPosts, followersCount } = metrics;
  const hasData = impressions > 0 || publishedPosts > 0;
  if (!hasData) return null;

  const engagementRate = followersCount && followersCount > 0
    ? (engagement / followersCount) * 100
    : null;

  const checks = [
    publishedPosts >= 1,
    publishedPosts >= 4,
    impressions >= 500,
    engagementRate != null ? engagementRate >= 1 : engagement > 0,
  ];
  const score = Math.round((checks.filter(Boolean).length / checks.length) * 100);
  const rateLabel = engagementRate != null ? ` (${engagementRate.toFixed(2)}% engagement rate)` : "";
  const notes = score >= 70
    ? `Actividad real detectada: ${publishedPosts} post(s), ${impressions} impresiones${rateLabel}.`
    : `Actividad real baja: ${publishedPosts} post(s), ${impressions} impresiones${rateLabel}. Publicar con mas frecuencia.`;
  return { area: "Rendimiento real en redes", score, notes };
}

function buildHeuristicBase(input: AuditEngineInput): AuditBase {
  const { profile, competitors, metrics } = input;

  const engagementArea = scoreEngagementMetrics(metrics);
  const areaScores = [
    scoreBrandIdentity(profile),
    scoreAudienceClarity(profile),
    scoreContentStrategy(profile),
    scoreSocialPresence(profile),
    scoreCompetitivePositioning(profile, competitors),
    ...(engagementArea ? [engagementArea] : []),
  ];

  const score = Math.round(areaScores.reduce((sum, area) => sum + area.score, 0) / areaScores.length);

  const strengths: string[] = [];
  const weaknesses: string[] = [];
  const opportunities: string[] = [];

  for (const area of areaScores) {
    if (area.score >= 70) strengths.push(`${area.area}: ${area.notes}`);
    else weaknesses.push(`${area.area}: ${area.notes}`);
  }

  if (strengths.length === 0) strengths.push("Perfil de marca recien creado, listo para construir desde cero.");
  if (weaknesses.length === 0) weaknesses.push("No se detectaron debilidades criticas en el perfil actual.");

  if (competitors.length > 0) {
    opportunities.push(`Analizar el contenido de ${competitors[0].name} para identificar formatos que estan funcionando.`);
  }
  if ((profile.activeSocialNetworks?.length ?? 0) < 3) {
    opportunities.push("Expandir presencia a redes adicionales relevantes para el publico objetivo.");
  }
  if (!filled(profile.contentPillars?.join(""))) {
    opportunities.push("Definir pilares de contenido claros para mantener consistencia en publicaciones.");
  }
  if (opportunities.length === 0) {
    opportunities.push("Profundizar en analisis de tendencias del nicho para detectar nuevos angulos de contenido.");
  }

  const recommendations: AuditRecommendation[] = areaScores
    .slice()
    .sort((a, b) => a.score - b.score)
    .slice(0, 5)
    .map((area) => ({
      title: `Mejorar: ${area.area}`,
      description: area.notes,
      impact: area.score < 40 ? "high" : area.score < 70 ? "medium" : "low",
      how: howStepsForArea(area.area),
    }));

  const ownEngagementRate = metrics?.followersCount && metrics.followersCount > 0
    ? (metrics.engagement / metrics.followersCount) * 100
    : null;

  const competitorComparison: AuditCompetitorComparison[] = competitors.slice(0, 5).map((competitor) => {
    const competitorRate = parsePercent(competitor.engagementRate);
    const vsAccount = ownEngagementRate != null && competitorRate != null
      ? {
          direction: (ownEngagementRate > competitorRate ? "up" : ownEngagementRate < competitorRate ? "down" : "equal") as
            | "up"
            | "down"
            | "equal",
          diff: `${Math.abs(ownEngagementRate - competitorRate).toFixed(2)}pp ${ownEngagementRate >= competitorRate ? "por encima" : "por debajo"} de ${competitor.name}`,
        }
      : null;

    return {
      competitor: competitor.name,
      comparison: competitor.engagementRate
        ? `Engagement reportado: ${competitor.engagementRate}. Compara tu actividad reciente con este referente.`
        : "Sin datos de engagement aun: registra metricas para comparar con tu marca.",
      followers: null,
      engagementRate: competitor.engagementRate ?? null,
      postingFrequency: competitor.postingFrequency ?? null,
      vsAccount,
    };
  });

  const summary = `Score global de presencia social: ${score}/100. ` +
    `${strengths.length} area(s) fuerte(s), ${weaknesses.length} area(s) por mejorar.`;

  return { score, areaScores, strengths, weaknesses, opportunities, recommendations, competitorComparison, summary };
}

export async function generateSocialAudit(input: AuditEngineInput): Promise<AuditBase> {
  const base = buildHeuristicBase(input);
  const { profile, competitors, metrics } = input;

  const metricsSection = metrics
    ? `
Metricas reales (ultimos 7 dias):
- Impresiones totales: ${metrics.impressions}
- Engagement total (likes + comentarios + shares): ${metrics.engagement}
- Posts publicados: ${metrics.publishedPosts}
- Seguidores (Instagram): ${metrics.followersCount ?? "(no disponible)"}
- Tasa de engagement: ${metrics.followersCount && metrics.followersCount > 0 ? `${((metrics.engagement / metrics.followersCount) * 100).toFixed(2)}%` : "(no calculable)"}
`
    : "\nMetricas reales: no disponibles aun — el cron de metricas no ha corrido o no hay cuentas conectadas.\n";

  const prompt = `Analiza el siguiente perfil de marca y genera una auditoria social estrategica.

Perfil de marca:
- Nombre: ${profile.brandName || "(sin definir)"}
- Nicho: ${profile.niche || "(sin definir)"}
- Descripcion: ${profile.shortDescription || "(sin definir)"}
- Tono de comunicacion: ${profile.toneOfVoice || "(sin definir)"}
- Publico objetivo: ${profile.audienceDescription || "(sin definir)"}
- Redes activas: ${profile.activeSocialNetworks?.join(", ") || "(ninguna)"}
- Palabras clave: ${profile.baseKeywords?.join(", ") || "(ninguna)"}
- Temas principales: ${profile.mainTopics?.join(", ") || "(ninguno)"}
${metricsSection}
Competidores (${competitors.length}):
${competitors.map((c) => `- ${c.name} (${c.platform}${c.handle ? `, ${c.handle}` : ""}) — engagementRate: ${c.engagementRate ?? "(sin dato)"}, frecuencia de publicacion: ${c.postingFrequency ?? "(sin dato)"}`).join("\n") || "(sin competidores)"}

Devuelve un JSON con: score global (0-100), desglose por area (areaScores con area/score/notes), fortalezas (strengths),
debilidades (weaknesses), oportunidades (opportunities), top 5 recomendaciones priorizadas (recommendations con
title/description/impact/how), y comparativa con competidores (competitorComparison con
competitor/comparison/followers/engagementRate/postingFrequency/vsAccount), y un resumen ejecutivo (summary). Se
especifico y orientado a acciones concretas. Si hay metricas reales, basate en ellas para calibrar el score y las
recomendaciones.

Para cada recommendation, el titulo debe ser una frase corta en lenguaje cotidiano que explique QUE PROBLEMA TIENE el
cliente (ej: "Tu audiencia no está definida", "No sabes qué publicar cada semana", "Tus hashtags no llegan a nadie
nuevo"). La description debe explicar en 1-2 frases POR QUÉ le afecta y QUÉ MEJORARÍA si lo resuelve, usando lenguaje
simple sin tecnicismos. El campo how debe ser un array de 2-3 pasos concretos y accionables para resolver el problema,
en imperativo (ej: "Ve a Mi Perfil y completa tu buyer persona"). Distingue claramente entre dos tipos: (a) "setup" —
algo que falta configurar para que el sistema funcione al 100%, empieza el título con "Falta: ", (b) "insight" — algo
que el Cerebro detectó analizando tu nicho o competencia, empieza con "Detectado: ". El campo impact debe ser "high",
"medium" o "low" según el impacto real en el crecimiento del cliente.

Para cada competidor en competitorComparison, usa UNICAMENTE los datos reales de engagementRate y frecuencia de
publicacion listados arriba para ese competidor: copia engagementRate y postingFrequency tal cual (o null si dice
"(sin dato)"). NUNCA inventes numero de seguidores: el campo followers debe ser siempre null porque no tenemos esa
metrica. El campo vsAccount debe ser null salvo que tengas tanto la tasa de engagement propia (ver metricas reales
arriba) como el engagementRate real del competidor; en ese caso calcula la diferencia real y devuelve
{ direction: "up"|"down"|"equal", diff: "X.XXpp por encima/debajo de <competidor>" }. Si falta cualquiera de los dos
datos, vsAccount debe ser null. No inventes datos: si no tienes el dato real, usa null.`;

  const system =
    "Eres el motor de auditoria social estrategica de SocialFlow. Analiza perfiles de marca y devuelve diagnosticos " +
    "honestos, especificos y orientados a accion. Responde SOLO con JSON valido que coincida exactamente con la forma solicitada. " +
    "Escribe siempre en español, en tono cercano y directo, como si fuera un community manager experto hablando con " +
    "su cliente. Nunca uses jerga técnica ni términos en inglés.";

  const { data } = await intelligenceModel.generateStructured({ prompt, system, tenantId: input.tenantId, saasId: input.saasId }, () => base);
  return data;
}
