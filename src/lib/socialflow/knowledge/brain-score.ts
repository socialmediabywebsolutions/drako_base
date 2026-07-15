import type { KnowledgeDoc } from "./repository";
import type { ChannelProfile } from "@/lib/socialflow/profile/types";

export type BrainScoreCardKey = "market" | "competitor" | "documents" | "style";

export type BrainScoreCard = {
  key: BrainScoreCardKey;
  label: string;
  complete: boolean;
};

export type BrainScore = {
  total: number;
  kbScore: number;
  profileScore: number;
  cards: BrainScoreCard[];
  missing: string[];
};

const KB_POINTS = { market: 15, competitor: 15, documents: 10, style: 10 } as const;
const PROFILE_POINTS = { niche: 10, tone: 10, pillars: 15, audience: 15 } as const;

function isFilled(value: string | null | undefined): boolean {
  return typeof value === "string" && value.trim().length > 0;
}

function hasItems(value: string[] | null | undefined): boolean {
  return Array.isArray(value) && value.length > 0;
}

export function calculateBrainScore(input: {
  docs: Pick<KnowledgeDoc, "type">[];
  profile: ChannelProfile;
}): BrainScore {
  const { docs, profile } = input;

  const hasMarket = docs.some((d) => d.type === "market_analysis");
  const hasCompetitor = docs.some((d) => d.type === "competitor");
  const hasDocuments = docs.some((d) => d.type === "pdf" || d.type === "url" || d.type === "text");
  const hasStyle = docs.some((d) => d.type === "auto_learned_style");

  const hasNiche = isFilled(profile.niche);
  const hasTone = isFilled(profile.toneOfVoice);
  const hasPillars = hasItems(profile.contentPillars);
  const hasAudience = isFilled(profile.audienceDescription);

  const kbScore =
    (hasMarket ? KB_POINTS.market : 0) +
    (hasCompetitor ? KB_POINTS.competitor : 0) +
    (hasDocuments ? KB_POINTS.documents : 0) +
    (hasStyle ? KB_POINTS.style : 0);

  const profileScore =
    (hasNiche ? PROFILE_POINTS.niche : 0) +
    (hasTone ? PROFILE_POINTS.tone : 0) +
    (hasPillars ? PROFILE_POINTS.pillars : 0) +
    (hasAudience ? PROFILE_POINTS.audience : 0);

  const missing: string[] = [];
  if (!hasMarket) missing.push("Analiza tu mercado");
  if (!hasCompetitor) missing.push("Añade al menos un competidor");
  if (!hasDocuments) missing.push("Sube un documento o añade una URL de tu marca");
  if (!hasStyle) missing.push("Sigue publicando para que la IA aprenda tu estilo de escritura");
  if (!hasNiche) missing.push("Completa tu nicho en el Perfil");
  if (!hasTone) missing.push("Define tu tono de voz en el Perfil");
  if (!hasPillars) missing.push("Añade tus pilares de contenido en el Perfil");
  if (!hasAudience) missing.push("Describe tu público objetivo en el Perfil");

  return {
    total: kbScore + profileScore,
    kbScore,
    profileScore,
    cards: [
      { key: "market", label: "Mercado", complete: hasMarket },
      { key: "competitor", label: "Competencia", complete: hasCompetitor },
      { key: "documents", label: "Documentos", complete: hasDocuments },
      { key: "style", label: "Estilo", complete: hasStyle },
    ],
    missing,
  };
}
