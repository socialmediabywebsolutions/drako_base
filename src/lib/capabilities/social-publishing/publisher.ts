import {
  publishSocialPost,
  type SocialPublishingChannel,
  type SocialPublishResult,
} from "@/lib/social-core/publishing";

export type SocialPublishingCapabilityChannel = SocialPublishingChannel;
export type SocialPublishingCapabilityResult = SocialPublishResult;

/**
 * Neutral social publishing capability used by product domains.
 * Domain code depends on this capability contract, not provider-specific modules.
 */
export async function publishSocialContent(
  channel: SocialPublishingCapabilityChannel,
  content: string,
): Promise<SocialPublishingCapabilityResult> {
  return publishSocialPost(channel, content);
}
