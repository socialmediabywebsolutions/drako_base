import { env } from "@/lib/cf";

export type SocialPublishingChannel = "linkedin" | "instagram" | "tiktok";

export type SocialPublishResult = {
  success: boolean;
  externalId?: string;
  error?: string;
  platform?: SocialPublishingChannel;
  retryCount?: number;
};

const MAX_RETRIES = 3;
const INITIAL_RETRY_DELAY_MS = 1000;

async function delay(ms: number): Promise<void> {
  return new Promise((resolve) => setTimeout(resolve, ms));
}

function readBinding(name: "SOCIALFLOW_API_KEY" | "SOCIALFLOW_API_URL"): string | undefined {
  const bindings = env() as unknown as Record<string, string | undefined>;
  const processValue = typeof process !== "undefined" ? process.env?.[name] : undefined;
  return processValue || bindings[name];
}

async function readJsonObject(response: Response): Promise<Record<string, unknown>> {
  const value = await response.json().catch(() => null);
  if (!value || typeof value !== "object" || Array.isArray(value)) return {};
  return value as Record<string, unknown>;
}

async function publishToConfiguredSocialProvider(
  channel: SocialPublishingChannel,
  content: string,
  retryCount: number = 0,
): Promise<SocialPublishResult> {
  const socialPublishingApiKey = readBinding("SOCIALFLOW_API_KEY");
  const socialPublishingApiUrl = readBinding("SOCIALFLOW_API_URL");

  if (!socialPublishingApiKey || !socialPublishingApiUrl) {
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
      platform: channel,
      content: content.trim(),
      schedule_immediately: true,
    };

    const response = await fetch(`${socialPublishingApiUrl}/api/v1/posts`, {
      method: "POST",
      headers: {
        Authorization: `Bearer ${socialPublishingApiKey}`,
        "Content-Type": "application/json",
      },
      body: JSON.stringify(payload),
    });

    if (!response.ok) {
      const errorData = await readJsonObject(response);
      const errorMessage = typeof errorData.message === "string" ? errorData.message : `HTTP ${response.status}`;

      if (retryCount < MAX_RETRIES) {
        const delayMs = INITIAL_RETRY_DELAY_MS * Math.pow(2, retryCount);
        await delay(delayMs);
        return publishToConfiguredSocialProvider(channel, content, retryCount + 1);
      }

      return {
        success: false,
        error: errorMessage,
        platform: channel,
        retryCount,
      };
    }

    const data = await readJsonObject(response);
    const externalId = typeof data.id === "string" ? data.id : typeof data.post_id === "string" ? data.post_id : null;

    if (!externalId) {
      if (retryCount < MAX_RETRIES) {
        const delayMs = INITIAL_RETRY_DELAY_MS * Math.pow(2, retryCount);
        await delay(delayMs);
        return publishToConfiguredSocialProvider(channel, content, retryCount + 1);
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
      return publishToConfiguredSocialProvider(channel, content, retryCount + 1);
    }

    return {
      success: false,
      error: errorMessage,
      platform: channel,
      retryCount,
    };
  }
}

export async function publishSocialPost(
  channel: SocialPublishingChannel,
  content: string,
): Promise<SocialPublishResult> {
  return publishToConfiguredSocialProvider(channel, content);
}
