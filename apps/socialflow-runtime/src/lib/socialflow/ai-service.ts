import { SocialFlowOrchestrator } from "@/lib/socialflow/ai/SocialFlowOrchestrator";
import { SocialContextError } from "./posts-repository";
import { getRuntimePostByIdFromDb, upsertRuntimePostInDb } from "./posts-repository";

export { SocialContextError };

export async function generateRuntimeCampaign(input: {
  tenantId: string;
  saasId: string;
  niche: string;
  tone: string;
  frequencyPerWeek: number;
}) {
  const orchestrator = new SocialFlowOrchestrator();
  return orchestrator.generateFullCampaign(input);
}

export async function regenerateRuntimePost(input: {
  tenantId: string;
  saasId: string;
  postId: string;
  niche: string;
  tone: string;
  frequencyPerWeek: number;
}) {
  const current = await getRuntimePostByIdFromDb({
    tenantId: input.tenantId,
    saasId: input.saasId,
    postId: input.postId,
  });
  if (!current) {
    return null;
  }

  const orchestrator = new SocialFlowOrchestrator();
  const regenerated = await orchestrator.generateSinglePost({
    tenantId: input.tenantId,
    saasId: input.saasId,
    niche: input.niche,
    tone: input.tone,
    frequencyPerWeek: input.frequencyPerWeek,
  });

  const nextBody = regenerated.optimized.improvedText ?? current.body;
  const nextTitle = regenerated.strategyItem?.theme ?? current.title;
  const hashtags = regenerated.optimized.hashtags ?? [];
  const primaryVariant = regenerated.generated.variants[0];

  return upsertRuntimePostInDb({
    tenantId: input.tenantId,
    post: {
      id: current.id,
      saasId: current.saasId,
      campaignId: current.campaignId,
      channelId: current.channelId ?? null,
      provider: current.provider,
      contentType: current.contentType,
      title: nextTitle,
      body: nextBody,
      imageHint: current.imageHint,
      status: current.status,
      scheduledAt: current.scheduledAt,
      postedAt: current.postedAt,
      externalPostId: current.externalPostId,
      metadata: {
        ...(current.metadata ?? {}),
        hook: primaryVariant?.hook,
        cta: primaryVariant?.callToAction,
        hashtags,
      },
    },
  });
}
