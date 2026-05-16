import type { RuntimeSocialAccount } from "../contracts";
import {
  LinkedInIntegrationError,
  publishLinkedInMemberPost,
  verifyLinkedInAccess,
} from "./core";

type LinkedInAccountAuthMeta = {
  accessToken?: string;
  authorUrn?: string;
  [key: string]: unknown;
};

function getLinkedInAuthMeta(account: RuntimeSocialAccount): LinkedInAccountAuthMeta {
  return (account.authMeta ?? {}) as LinkedInAccountAuthMeta;
}

function requireLinkedInAccessToken(account: RuntimeSocialAccount): string {
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

function requireLinkedInAuthorUrn(account: RuntimeSocialAccount): string {
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

export async function publishRuntimeLinkedInPost(account: RuntimeSocialAccount, content: string) {
  return publishLinkedInMemberPost({
    accessToken: requireLinkedInAccessToken(account),
    authorUrn: requireLinkedInAuthorUrn(account),
    content,
  });
}

export async function validateRuntimeLinkedInAccount(account: RuntimeSocialAccount) {
  return verifyLinkedInAccess(requireLinkedInAccessToken(account));
}
