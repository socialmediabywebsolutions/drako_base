import { listSaasSocialPosts, resolveSocialContext } from "@/lib/socialflow/repository";
import { seedFeedItems, dismissFeedItemsBySource } from "@/lib/socialflow/intelligence/repository";
import { classifyHook } from "./contentHeuristics";
import type { SaasSocialPost } from "@/lib/social-core/types";

const MAX_POSTS_ANALYZED = 20;
const MIN_POSTS_FOR_CHECK = 5;
const FATIGUE_STREAK_THRESHOLD = 5;

const HOOK_SOURCE = "content_fatigue:hook";
const FORMAT_SOURCE = "content_fatigue:format";

export type ContentFatigueResult = {
  hookStreak: { value: string; length: number };
  formatStreak: { value: string; length: number };
  hookFatigued: boolean;
  formatFatigued: boolean;
};

function hookKey(post: SaasSocialPost): string {
  return classifyHook(post.body.split("\n")[0] ?? "");
}

function formatKey(post: SaasSocialPost): string {
  return post.contentType;
}

// Counts how many of the most recent posts (index 0 = newest) share the same key,
// starting from the newest and stopping at the first post that breaks the pattern.
// Deliberately the CURRENT streak, not the longest streak anywhere in the window —
// what matters for "alert before engagement drops" is what the tenant is doing right
// now, not an old pattern that already broke.
function currentStreak(
  postsNewestFirst: SaasSocialPost[],
  keyFor: (post: SaasSocialPost) => string,
): { value: string; length: number } {
  const value = keyFor(postsNewestFirst[0]);
  let length = 1;
  for (let i = 1; i < postsNewestFirst.length; i += 1) {
    if (keyFor(postsNewestFirst[i]) !== value) break;
    length += 1;
  }
  return { value, length };
}

export class ContentFatigueAgent {
  async run(input: { tenantId: string; saasId: string }): Promise<ContentFatigueResult | null> {
    const ctx = await resolveSocialContext({ tenantId: input.tenantId, saasId: input.saasId });
    const allPosts = await listSaasSocialPosts(ctx);

    const published = allPosts
      .filter((post) => post.status === "POSTED" || post.status === "PUBLISHED")
      .sort((a, b) =>
        new Date(b.postedAt ?? b.scheduledAt ?? b.createdAt).getTime()
        - new Date(a.postedAt ?? a.scheduledAt ?? a.createdAt).getTime(),
      )
      .slice(0, MAX_POSTS_ANALYZED);

    if (published.length < MIN_POSTS_FOR_CHECK) {
      await Promise.all([
        dismissFeedItemsBySource(input.tenantId, HOOK_SOURCE, input.saasId),
        dismissFeedItemsBySource(input.tenantId, FORMAT_SOURCE, input.saasId),
      ]);
      return null;
    }

    const hookStreak = currentStreak(published, hookKey);
    const formatStreak = currentStreak(published, formatKey);
    const hookFatigued = hookStreak.length >= FATIGUE_STREAK_THRESHOLD;
    const formatFatigued = formatStreak.length >= FATIGUE_STREAK_THRESHOLD;

    if (hookFatigued) {
      await seedFeedItems(
        input.tenantId,
        [{
          type: "alert",
          priority: "high",
          title: "Estás repitiendo el mismo estilo",
          description: `Tus últimos ${hookStreak.length} posts usan el mismo tipo de hook ("${hookStreak.value}"). Prueba algo distinto para no perder enganche.`,
          actionLabel: "Generar contenido variado",
          actionHref: "/socialflow/ai",
          source: HOOK_SOURCE,
        }],
        input.saasId,
      );
    } else {
      await dismissFeedItemsBySource(input.tenantId, HOOK_SOURCE, input.saasId);
    }

    if (formatFatigued) {
      await seedFeedItems(
        input.tenantId,
        [{
          type: "alert",
          priority: "high",
          title: "Estás repitiendo el mismo estilo",
          description: `Tus últimos ${formatStreak.length} posts son del mismo formato (${formatStreak.value}). Prueba algo distinto para no perder enganche.`,
          actionLabel: "Generar contenido variado",
          actionHref: "/socialflow/ai",
          source: FORMAT_SOURCE,
        }],
        input.saasId,
      );
    } else {
      await dismissFeedItemsBySource(input.tenantId, FORMAT_SOURCE, input.saasId);
    }

    return { hookStreak, formatStreak, hookFatigued, formatFatigued };
  }
}
