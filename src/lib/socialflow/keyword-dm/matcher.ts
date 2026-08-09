import type { KeywordDmTrigger } from "./types";

function triggerMatches(trigger: KeywordDmTrigger, commentText: string): boolean {
  const normalizedComment = commentText.trim().toLowerCase();
  const normalizedKeyword = trigger.keyword.trim().toLowerCase();
  if (!normalizedKeyword) return false;
  return trigger.matchType === "exact"
    ? normalizedComment === normalizedKeyword
    : normalizedComment.includes(normalizedKeyword);
}

// Precedencia cuando varios triggers activos matchean el mismo comentario: exact gana
// sobre contains; entre iguales, el trigger creado más recientemente (mayor created_at)
// gana. target_post_id null significa "todos los posts del tenant".
export function pickMatchingTrigger(
  triggers: KeywordDmTrigger[],
  commentText: string,
  postId: string,
): KeywordDmTrigger | null {
  const candidates = triggers.filter(
    (t) => t.active && (t.targetPostId === null || t.targetPostId === postId) && triggerMatches(t, commentText),
  );
  if (!candidates.length) return null;

  candidates.sort((a, b) => {
    if (a.matchType !== b.matchType) return a.matchType === "exact" ? -1 : 1;
    return new Date(b.createdAt).getTime() - new Date(a.createdAt).getTime();
  });

  return candidates[0];
}
