import { env } from "@/lib/cf";

export type SocialFlowPublishResult = {
  success: boolean;
  externalId?: string;
  error?: string;
  platform?: string;
  retryCount?: number;
};

const MAX_RETRIES = 3;
const INITIAL_RETRY_DELAY_MS = 1000;

async function delay(ms: number): Promise<void> {
  return new Promise((resolve) => setTimeout(resolve, ms));
}

async function publishToSocialFlow(
  channel: "linkedin" | "instagram" | "tiktok",
  content: string,
  retryCount: number = 0
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
      
      if (retryCount < MAX_RETRIES) {
        const delayMs = INITIAL_RETRY_DELAY_MS * Math.pow(2, retryCount);
        await delay(delayMs);
        return publishToSocialFlow(channel, content, retryCount + 1);
      }

      return {
        success: false,
        error: errorMessage,
        platform: channel,
        retryCount,
      };
    }

    const data = (await response.json()) as any;
    const externalId = data?.id || data?.post_id;

    if (!externalId) {
      if (retryCount < MAX_RETRIES) {
        const delayMs = INITIAL_RETRY_DELAY_MS * Math.pow(2, retryCount);
        await delay(delayMs);
        return publishToSocialFlow(channel, content, retryCount + 1);
      }

      return {
        success: false,
        error: "NO_EXTERNAL_ID_RETURNED",
        platform: channel,
        retryCount,
      };
    }

    return {
      success: true,
      externalId,
      platform: channel,
      retryCount,
    };
  } catch (error) {
    const errorMessage = error instanceof Error ? error.message : String(error);

    if (retryCount < MAX_RETRIES) {
      const delayMs = INITIAL_RETRY_DELAY_MS * Math.pow(2, retryCount);
      await delay(delayMs);
      return publishToSocialFlow(channel, content, retryCount + 1);
    }

    return {
      success: false,
      error: errorMessage,
      platform: channel,
      retryCount,
    };
  }
}

export async function publishPost(
  channel: "linkedin" | "instagram" | "tiktok",
  content: string
): Promise<SocialFlowPublishResult> {
  return publishToSocialFlow(channel, content);
}
