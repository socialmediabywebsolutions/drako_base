import { env } from "@/lib/cf";

export type SocialFlowPublishResult = {
  success: boolean;
  externalId?: string;
  error?: string;
  platform?: string;
};

async function publishToSocialFlow(
  channel: "linkedin" | "instagram" | "tiktok",
  content: string
): Promise<SocialFlowPublishResult> {
  const bindings = env();
  const socialflowApiKey =
    (typeof process !== "undefined" ? process.env?.SOCIALFLOW_API_KEY : undefined) ||
    ((bindings as unknown as Record<string, string | undefined>)?.SOCIALFLOW_API_KEY);
  const socialflowApiUrl =
    (typeof process !== "undefined" ? process.env?.SOCIALFLOW_API_URL : undefined) ||
    ((bindings as unknown as Record<string, string | undefined>)?.SOCIALFLOW_API_URL);

  if (!socialflowApiKey || !socialflowApiUrl) {
    return {
      success: false,
      error: "SOCIALFLOW_CREDENTIALS_MISSING",
    };
  }

  if (!content || content.trim().length === 0) {
    return {
      success: false,
      error: "EMPTY_CONTENT",
    };
  }

  try {
    const payload = {
      platform: channel === "linkedin" ? "linkedin" : channel === "instagram" ? "instagram" : "tiktok",
      content: content.trim(),
      schedule_immediately: true,
    };

    const response = await fetch(`${socialflowApiUrl}/api/v1/posts`, {
      method: "POST",
      headers: {
        Authorization: `Bearer ${socialflowApiKey}`,
        "Content-Type": "application/json",
      },
      body: JSON.stringify(payload),
    });

    if (!response.ok) {
      const errorData = await response.json().catch(() => ({}));
      const errorMessage = (errorData as any)?.message || `HTTP ${response.status}`;
      return {
        success: false,
        error: errorMessage,
        platform: channel,
      };
    }

    const data = (await response.json()) as any;
    const externalId = data?.id || data?.post_id;

    if (!externalId) {
      return {
        success: false,
        error: "NO_EXTERNAL_ID_RETURNED",
        platform: channel,
      };
    }

    return {
      success: true,
      externalId,
      platform: channel,
    };
  } catch (error) {
    const errorMessage = error instanceof Error ? error.message : String(error);
    return {
      success: false,
      error: errorMessage,
      platform: channel,
    };
  }
}

export async function publishPost(
  channel: "linkedin" | "instagram" | "tiktok",
  content: string
): Promise<SocialFlowPublishResult> {
  return publishToSocialFlow(channel, content);
}
