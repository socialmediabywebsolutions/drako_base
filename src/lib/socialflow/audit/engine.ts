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
    : "Faltan datos clave de identidad de marca (descripcion, tono o diferenciadores).";
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
    : "El publico objetivo necesita mas detalle: dolores, deseos y buyer persona.";
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
    : "Falta definir pilares de contenido, temas principales y formatos preferidos.";
  return { area: "Estrategia de contenido", score, notes };
}

function scoreSocialPresence(profile: ChannelProfile): AuditAreaScore {
  const networkCount = profile.activeSocialNetworks?.length ?? 0;
  const checks = [networkCount >= 1, networkCount >= 2, networkCount >= 3, filled(profile.websiteUrl)];
  const score = Math.round((checks.filter(Boolean).length / checks.length) * 100);
  const notes = networkCount === 0
    ? "Aun no hay redes sociales activas registradas."
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
    }));

  const competitorComparison: AuditCompetitorComparison[] = competitors.slice(0, 5).map((competitor) => ({
    competitor: competitor.name,
    comparison: competitor.engagementRate
      ? `Engagement reportado: ${competitor.engagementRate}. Compara tu actividad reciente con este referente.`
      : "Sin datos de engagement aun: registra metricas para comparar con tu marca.",
  }));

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
${competitors.map((c) => `- ${c.name} (${c.platform}${c.handle ? `, ${c.handle}` : ""})`).join("\n") || "(sin competidores)"}

Devuelve un JSON con: score global (0-100), desglose por area (areaScores con area/score/notes), fortalezas (strengths),
debilidades (weaknesses), oportunidades (opportunities), top 5 recomendaciones priorizadas (recommendations con
title/description/impact), y comparativa con competidores (competitorComparison con competitor/comparison), y un
resumen ejecutivo (summary). Se especifico y orientado a acciones concretas. Si hay metricas reales, basate en ellas
para calibrar el score y las recomendaciones.`;

  const system =
    "Eres el motor de auditoria social estrategica de SocialFlow. Analiza perfiles de marca y devuelve diagnosticos " +
    "honestos, especificos y orientados a accion. Responde SOLO con JSON valido que coincida exactamente con la forma solicitada.";

  const { data } = await intelligenceModel.generateStructured({ prompt, system, tenantId: input.tenantId, saasId: input.saasId }, () => base);
  return data;
}
