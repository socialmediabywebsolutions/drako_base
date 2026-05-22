import {
  LinkedInIntegrationError,
  publishLinkedInMemberPost,
  verifyLinkedInAccess,
} from "@/lib/socialflow/linkedin/core";
import type { SaasSocialAccount } from "@/lib/social-core/types";
import { decryptToken } from "@/lib/socialflow/token-encryption";

type LinkedInAccountAuthMeta = {
  accessToken?: string;
  authorUrn?: string;
  scope?: string;
  [key: string]: unknown;
};

const LINKEDIN_MEMBER_SCOPE = "w_member_social";

function getLinkedInAuthMeta(account: SaasSocialAccount): LinkedInAccountAuthMeta {
  return (account.authMeta ?? {}) as LinkedInAccountAuthMeta;
}

function parseLinkedInScopes(account: SaasSocialAccount) {
  const rawScope = typeof getLinkedInAuthMeta(account).scope === "string"
    ? getLinkedInAuthMeta(account).scope!.trim()
    : "";

  if (!rawScope) return new Set<string>();
  const tokens = rawScope
    .split(/[\s,]+/)
    .map((value) => value.trim())
    .filter((value) => value.length > 0);
  return new Set(tokens);
}

async function requireLinkedInAccessToken(account: SaasSocialAccount): Promise<string> {
  const storedToken = typeof getLinkedInAuthMeta(account).accessToken === "string"
    ? getLinkedInAuthMeta(account).accessToken!.trim()
    : "";
  if (!storedToken) {
    throw new LinkedInIntegrationError("LinkedIn access token is required.", {
      code: "LINKEDIN_ACCESS_TOKEN_MISSING",
      accountStatus: "INVALID_CREDENTIALS",
    });
  }

  const accessToken = await decryptToken(storedToken);
  if (!accessToken) {
    throw new LinkedInIntegrationError("LinkedIn access token decryption failed.", {
      code: "LINKEDIN_ACCESS_TOKEN_DECRYPTION_FAILED",
      accountStatus: "INVALID_CREDENTIALS",
    });
  }

  return accessToken;
}

function requireLinkedInAuthorUrn(account: SaasSocialAccount): string {
  const authorUrn = typeof getLinkedInAuthMeta(account).authorUrn === "string"
    ? getLinkedInAuthMeta(account).authorUrn!.trim()
    : "";
  if (!authorUrn) {
    throw new LinkedInIntegrationError("LinkedIn author URN is required.", {
      code: "LINKEDIN_AUTHOR_URN_MISSING",
      accountStatus: "INVALID_CREDENTIALS",
    });
  }
  return authorUrn;
}

export async function publishPost(account: SaasSocialAccount, content: string) {
  const scopes = parseLinkedInScopes(account);
  if (!scopes.has(LINKEDIN_MEMBER_SCOPE)) {
    throw new LinkedInIntegrationError("LinkedIn member publish scope is missing.", {
      code: "LINKEDIN_SCOPE_MISSING_W_MEMBER_SOCIAL",
      accountStatus: "INVALID_CREDENTIALS",
    });
  }

  return publishLinkedInMemberPost({
    accessToken: await requireLinkedInAccessToken(account),
    authorUrn: requireLinkedInAuthorUrn(account),
    content,
  });
}

export async function validateAccount(account: SaasSocialAccount) {
  const scopes = parseLinkedInScopes(account);
  if (!scopes.has(LINKEDIN_MEMBER_SCOPE)) {
    throw new LinkedInIntegrationError("LinkedIn member publish scope is missing.", {
      code: "LINKEDIN_SCOPE_MISSING_W_MEMBER_SOCIAL",
      accountStatus: "INVALID_CREDENTIALS",
    });
  }

  return verifyLinkedInAccess(await requireLinkedInAccessToken(account));
}

export async function refreshToken(_account: SaasSocialAccount) {
  throw new LinkedInIntegrationError("LinkedIn member tokens cannot be refreshed automatically in this flow.", {
    code: "LINKEDIN_REFRESH_NOT_SUPPORTED",
    accountStatus: "PENDING",
  });
}
