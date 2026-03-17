import type { SaasSocialPost } from "@/lib/social/types";

export async function publishSocialPostLive(_post: SaasSocialPost): Promise<{ ok: boolean; code?: string; message?: string; externalPostId?: string | null }> {
  return { ok: true, code: "LIVE_PUBLISH_PLACEHOLDER", message: "Live publish stub", externalPostId: null };
}
