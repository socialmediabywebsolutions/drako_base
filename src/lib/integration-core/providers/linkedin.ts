import { registerIntegrationDefinition } from "@/lib/integration-core/definitions";
import { registerIntegrationProvider } from "@/lib/integration-core/providers";
import type {
  IntegrationConnection,
  IntegrationProvider,
} from "@/lib/integration-core/types";
import {
  LinkedInIntegrationError,
  publishLinkedInMemberPost,
  verifyLinkedInAccess,
} from "@/lib/socialflow/linkedin/core";

export const LINKEDIN_INTEGRATION_KEY = "linkedin";

type LinkedInCredentials = {
  accessToken?: string;
  authorUrn?: string;
  profileId?: string;
  [key: string]: unknown;
};

function getLinkedInCredentials(connection: IntegrationConnection): LinkedInCredentials {
  return (connection.credentials ?? {}) as LinkedInCredentials;
}

function requireAccessToken(connection: IntegrationConnection): string {
  const accessToken = typeof getLinkedInCredentials(connection).accessToken === "string"
    ? getLinkedInCredentials(connection).accessToken!.trim()
    : "";
  if (!accessToken) {
    throw new LinkedInIntegrationError("LinkedIn access token is required.", {
      code: "LINKEDIN_ACCESS_TOKEN_MISSING",
      accountStatus: "INVALID_CREDENTIALS",
    });
  }
  return accessToken;
}

async function publishLinkedInPost(input: {
  connection: IntegrationConnection;
  payload: Record<string, unknown> | null;
}): Promise<{ externalPostId: string | null }> {
  const accessToken = requireAccessToken(input.connection);
  const credentials = getLinkedInCredentials(input.connection);
  const authorUrn = typeof credentials.authorUrn === "string" ? credentials.authorUrn.trim() : "";
  if (!authorUrn) {
    throw new LinkedInIntegrationError("LinkedIn author URN is required.", {
      code: "LINKEDIN_AUTHOR_URN_MISSING",
      accountStatus: "INVALID_CREDENTIALS",
    });
  }

  const bodyText =
    typeof input.payload?.body === "string" && input.payload.body.trim()
      ? input.payload.body.trim()
      : typeof input.payload?.title === "string"
        ? input.payload.title.trim()
        : "";

  if (!bodyText) {
    throw new Error("LINKEDIN_POST_BODY_REQUIRED");
  }

  const response = await publishLinkedInMemberPost({
    accessToken,
    authorUrn,
    content: bodyText,
  });

  return {
    externalPostId: response.externalPostId,
  };
}

const linkedInProvider: IntegrationProvider = {
  async validate({ connection }) {
    try {
      const accessToken = requireAccessToken(connection);
      const profile = await verifyLinkedInAccess(accessToken);
      return {
        ok: true,
        status: "CONNECTED",
        checkedAt: new Date().toISOString(),
        metadata: {
          ...(connection.metadata ?? {}),
          displayName: profile.displayName,
          authorUrn: profile.authorUrn,
          profileId: profile.profileId,
          tokenStatus: "active",
        },
      };
    } catch (error) {
      const normalized = error instanceof LinkedInIntegrationError
        ? error
        : new LinkedInIntegrationError(
            error instanceof Error ? error.message : "LinkedIn connection could not be verified.",
            { code: "LINKEDIN_CONNECTION_INVALID", accountStatus: "INVALID_CREDENTIALS" },
          );

      return {
        ok: false,
        status: normalized.accountStatus === "INVALID_CREDENTIALS" ? "INVALID" : "PENDING",
        checkedAt: new Date().toISOString(),
        error: {
          code: normalized.code,
          message: normalized.message,
        },
      };
    }
  },

  async executeOperation({ operationKey, payload, connection }) {
    if (operationKey !== "publish_post") {
      return {
        ok: false,
        error: {
          code: "INTEGRATION_OPERATION_NOT_SUPPORTED",
          message: `${operationKey} is not supported by LinkedIn`,
        },
      };
    }

    try {
      const result = await publishLinkedInPost({ connection, payload });
      return {
        ok: true,
        result: {
          externalPostId: result.externalPostId,
        },
      };
    } catch (error) {
      return {
        ok: false,
        error: {
          code: "LINKEDIN_PUBLISH_FAILED",
          message: error instanceof Error ? error.message : "LinkedIn publish failed",
        },
      };
    }
  },
};

let linkedinRegistered = false;

export async function ensureLinkedInIntegrationAvailable(): Promise<void> {
  await registerIntegrationDefinition({
    integrationKey: LINKEDIN_INTEGRATION_KEY,
    displayName: "LinkedIn",
    provider: "linkedin",
    category: "social",
    authMode: "token",
    enabled: true,
    supportedOperations: ["publish_post"],
  });

  if (!linkedinRegistered) {
    registerIntegrationProvider(LINKEDIN_INTEGRATION_KEY, linkedInProvider);
    linkedinRegistered = true;
  }
}
