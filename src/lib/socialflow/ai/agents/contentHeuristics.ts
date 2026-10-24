import type { SaasSocialPost } from "@/lib/social-core/types";

export function extractHashtags(post: SaasSocialPost): string[] {
  const fromMetadata = Array.isArray(post.metadata?.hashtags)
    ? (post.metadata!.hashtags as unknown[]).filter((h): h is string => typeof h === "string")
    : [];
  const fromBody = post.body.match(/#[\p{L}0-9_]+/gu) ?? [];
  return Array.from(new Set([...fromMetadata, ...fromBody].map((h) => h.toLowerCase())));
}

// Heuristic hook classifier — regex-based, mirrors classifiers used elsewhere in this
// codebase (e.g. pickOpenerCategory in generate-from-image). Deterministic and free —
// no LLM call — so it's safe to run per-post across every tenant of a niche without
// rate-limit or cost concerns (see CrossTenantIntelligenceAgent).
export function classifyHook(firstLine: string): string {
  const line = firstLine.trim();
  if (!line) return "sin hook";
  if (/^(\d+)\s/.test(line)) return "lista numerada";
  if (/\?\s*$/.test(line)) return "pregunta directa";
  if (/^(nadie|nunca|lo que nadie|nadie te dice)/i.test(line)) return "revelación / secreto";
  if (/^(antes de|si (estás|quieres|trabajas|eres))/i.test(line)) return "condicional / advertencia";
  if (/^(te comparto|hoy|esta semana|esta es)/i.test(line)) return "anuncio directo";
  return "afirmación directa";
}
