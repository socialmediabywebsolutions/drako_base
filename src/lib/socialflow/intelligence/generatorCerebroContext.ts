import type { DracoEnv } from "@/lib/cf";
import { getInfluencerBenchmarkAnyAge, type InfluencerBenchmarkWithFreshness } from "./InfluencerBenchmarkAgent";
import { getLatestViralMoments, type ViralMomentResult } from "@/lib/socialflow/ai/agents/ViralMomentAgent";
import { getLatestStrategicPlan, type StrategicPlanResult } from "@/lib/socialflow/ai/agents/StrategicPlanningAgent";
import { getLatestBestPractices, type BestPracticesResult } from "@/lib/socialflow/ai/agents/BestPracticesAgent";

const TOP_CHANNELS = 3;
const HOOKS_PER_CHANNEL = 3;
const MAX_VIRAL_MOMENTS = 3;
const MAX_PRIORITIES = 3;
const MAX_BEST_PRACTICE_LINES = 4;
const DAY_MS = 24 * 60 * 60 * 1000;

// Contexto del Cerebro que hasta ahora solo llegaba al chat de ideas
// (/api/socialflow/ai/chat) y nunca al generador de posts: benchmark de creadores top
// del nicho, momentos virales, mejores prácticas y plan estratégico del cliente. Cada
// fuente es opcional y falla por separado — un bloque sin datos simplemente no aparece,
// y sin ningún dato la sección entera es "" (prompt idéntico al de antes).
export async function buildGeneratorCerebroSection(input: {
  niche: string;
  dracoEnv: DracoEnv;
  tenantId?: string;
  saasId?: string;
}): Promise<string> {
  const { niche, dracoEnv, tenantId, saasId } = input;
  const hasTenant = Boolean(tenantId && saasId);

  const [benchmark, viral, bestPractices, plan] = await Promise.all([
    getInfluencerBenchmarkAnyAge(niche, dracoEnv, tenantId, saasId).catch(() => null),
    hasTenant ? getLatestViralMoments(tenantId!, saasId!, dracoEnv).catch(() => null) : Promise.resolve(null),
    hasTenant ? getLatestBestPractices(tenantId!, saasId!, dracoEnv).catch(() => null) : Promise.resolve(null),
    hasTenant ? getLatestStrategicPlan(tenantId!, saasId!, dracoEnv).catch(() => null) : Promise.resolve(null),
  ]);

  const blocks = [
    formatBenchmark(benchmark),
    formatViralMoments(viral),
    formatBestPractices(bestPractices),
    formatStrategicPlan(plan),
  ].filter(Boolean);

  if (!blocks.length) return "";
  return `\n## Inteligencia del Cerebro Socialcors\n${blocks.join("\n")}`;
}

function formatBenchmark(data: InfluencerBenchmarkWithFreshness | null): string {
  const channels = data?.benchmark.topChannels?.slice(0, TOP_CHANNELS) ?? [];
  if (!data || !channels.length) return "";

  const ageDays = Math.max(0, Math.round((Date.now() - new Date(data.updatedAt).getTime()) / DAY_MS));
  const heading = data.stale
    ? `Creadores top del nicho en YouTube — referencia aproximada (datos de hace ${ageDays} días, úsalos como inspiración de estilo, no como tendencia actual):`
    : "Creadores top del nicho en YouTube esta semana:";
  const lines = channels.map((c) => {
    const hooks = (c.topHooks ?? []).slice(0, HOOKS_PER_CHANNEL).map((h) => `"${h}"`).join(" | ");
    return `- ${c.name} (${Number(c.subscribers ?? 0).toLocaleString("es-ES")} suscriptores, ~${Number(c.avgViews ?? 0).toLocaleString("es-ES")} vistas/vídeo)${hooks ? ` — hooks reales: ${hooks}` : ""}`;
  });
  const commonHooks = data.benchmark.patterns?.commonHooks ?? [];
  if (commonHooks.length) lines.push(`- Tipos de hook que se repiten entre ellos: ${commonHooks.join(", ")}`);
  return `${heading}\n${lines.join("\n")}`;
}

function formatViralMoments(data: ViralMomentResult | null): string {
  const moments = [...(data?.viralMoments ?? [])]
    .sort((a, b) => b.momentumScore - a.momentumScore)
    .slice(0, MAX_VIRAL_MOMENTS);
  if (!moments.length) return "";
  const lines = moments.map((m) => `- "${m.topic}" — ${m.suggestedAngle}`);
  return `Momentos virales activos en tu nicho ahora mismo (si encaja con el ángulo, aprovéchalo):\n${lines.join("\n")}`;
}

function formatBestPractices(data: BestPracticesResult | null): string {
  const lines = [...(data?.recommendations ?? []), ...(data?.gaps ?? [])].slice(0, MAX_BEST_PRACTICE_LINES);
  if (!lines.length) return "";
  return `Mejores prácticas detectadas frente a los mejores de tu nicho:\n${lines.map((l) => `- ${l}`).join("\n")}`;
}

function formatStrategicPlan(data: StrategicPlanResult | null): string {
  if (!data?.monthlyObjective) return "";
  const lines = [`- Objetivo del mes: ${data.monthlyObjective}`];
  const priorities = (data.priorities ?? []).slice(0, MAX_PRIORITIES);
  if (priorities.length) lines.push(`- Prioridades: ${priorities.join(" | ")}`);
  if (data.keyOpportunity) lines.push(`- Oportunidad clave: ${data.keyOpportunity}`);
  return `Plan estratégico del cliente (el post debe empujar en esta dirección):\n${lines.join("\n")}`;
}
