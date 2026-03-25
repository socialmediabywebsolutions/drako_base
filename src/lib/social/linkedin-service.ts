import {
  LinkedInIntegrationError,
  publishLinkedInMemberPost,
  verifyLinkedInAccess,
} from "@/lib/social/linkedin";
import type { SaasSocialAccount } from "@/lib/social/types";

type LinkedInAccountAuthMeta = {
  accessToken?: string;
  authorUrn?: string;
  [key: string]: unknown;
};

function getLinkedInAuthMeta(account: SaasSocialAccount): LinkedInAccountAuthMeta {
  return (account.authMeta ?? {}) as LinkedInAccountAuthMeta;
}

function requireLinkedInAccessToken(account: SaasSocialAccount): string {
  const accessToken = typeof getLinkedInAuthMeta(account).accessToken === "string"
    ? getLinkedInAuthMeta(account).accessToken!.trim()
    : "";
  if (!accessToken) {
    throw new LinkedInIntegrationError("LinkedIn access token is required.", {
      code: "LINKEDIN_ACCESS_TOKEN_MISSING",
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
  return publishLinkedInMemberPost({
    accessToken: requireLinkedInAccessToken(account),
    authorUrn: requireLinkedInAuthorUrn(account),
    content,
  });
}

export async function validateAccount(account: SaasSocialAccount) {
  return verifyLinkedInAccess(requireLinkedInAccessToken(account));
}

export async function refreshToken(_account: SaasSocialAccount) {
  throw new LinkedInIntegrationError("LinkedIn member tokens cannot be refreshed automatically in this flow.", {
    code: "LINKEDIN_REFRESH_NOT_SUPPORTED",
    accountStatus: "PENDING",
  });
}
