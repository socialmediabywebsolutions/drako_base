// Strip greeting openings the LLM generates despite prompt instructions.
// Three-pass: removes the greeting word, then residual vocatives ("chicas!")
// that survive, then a lone "A veces" opener the LLM defaults to when told
// to avoid greetings. Single source of truth — previously duplicated in
// posts/generate-from-image/route.ts and campaigns/[id]/photos/route.ts, and
// never applied in SocialFlowOrchestrator.persistToDb() at all.
export function cleanOpening(text: string): string {
  return text
    .replace(
      /^[¡!]*\s*(hola|hey|buenas?(?:\s+(?:d[ií]as?|tardes?|noches?))?|buenos\s+d[ií]as?)\b[^a-záéíóúüñ\n]*/i,
      "",
    )
    .replace(/^chicas?\s*[!,.\s¡]*/i, "")
    .replace(/^a\s+veces\s*[,.\s]*/i, "")
    .trimStart();
}
