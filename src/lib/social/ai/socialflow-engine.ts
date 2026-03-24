import type { SaasSocialPost } from "@/lib/social/types";
import { listSaasSocialPosts, resolveSocialContext } from "@/lib/social/repository";
import { SocialFlowOrchestrator } from "./SocialFlowOrchestrator";

export type SocialFlowEngineInput = { tenantId: string; saasId: string; niche: string; tone: string; frequencyPerWeek: number };
export type SocialFlowEngineOutput = { campaignId: string; posts: SaasSocialPost[]; schedule: { postId: string; scheduledAt: string }[] };

export async function runSocialFlowEngine(input: SocialFlowEngineInput): Promise<SocialFlowEngineOutput> {
  const orchestrator = new SocialFlowOrchestrator();
  const result = await orchestrator.generateFullCampaign({ tenantId: input.tenantId, saasId: input.saasId, niche: input.niche, tone: input.tone, frequencyPerWeek: input.frequencyPerWeek });
  const campaignId = result.campaignId;
  if (!campaignId) throw new Error("SocialFlowEngine: missing campaignId from orchestrator result");
  const ctx = await resolveSocialContext({ tenantId: input.tenantId, saasId: input.saasId });
  const posts = await listSaasSocialPosts(ctx, { campaignId, status: null, provider: null });
  return { campaignId, posts, schedule: posts.filter((post) => Boolean(post.scheduledAt)).map((post) => ({ postId: post.id, scheduledAt: post.scheduledAt as string })) };
}
