import type { RuntimeSocialAccount } from "../contracts";
import { decryptToken, isEncryptedToken } from "../token-encryption";
import {
  LinkedInIntegrationError,
  publishLinkedInMemberPost,
  verifyLinkedInAccess,
} from "./core";

type LinkedInAccountAuthMeta = {
  accessToken?: string;
  scope?: string;
  authorUrn?: string;
  organizationRole?: string;
  orgRole?: string;
  [key: string]: unknown;
};

const LINKEDIN_MEMBER_SCOPE = "w_member_social";
const LINKEDIN_ORGANIZATION_SCOPE = "w_organization_social";
const LINKEDIN_ALLOWED_ORGANIZATION_ROLES = new Set([
  "ADMINISTRATOR",
  "CONTENT_ADMINISTRATOR",
  "DIRECT_SPONSORED_CONTENT_POSTER",
  "SUPER_ADMIN",
]);

function getLinkedInAuthMeta(account: RuntimeSocialAccount): LinkedInAccountAuthMeta {
  return (account.authMeta ?? {}) as LinkedInAccountAuthMeta;
}

function parseLinkedInScopes(account: RuntimeSocialAccount) {
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

function resolveOrganizationRole(account: RuntimeSocialAccount) {
  const authMeta = getLinkedInAuthMeta(account);
  const rawRole = typeof authMeta.organizationRole === "string"
    ? authMeta.organizationRole
    : typeof authMeta.orgRole === "string"
      ? authMeta.orgRole
      : "";
  const normalized = rawRole.trim().toUpperCase();
  return normalized || null;
}

async function requireLinkedInAccessToken(
  account: RuntimeSocialAccount,
  options?: { requireEncrypted?: boolean },
): Promise<string> {
  const encryptedToken = typeof getLinkedInAuthMeta(account).accessToken === "string"
    ? getLinkedInAuthMeta(account).accessToken!.trim()
    : "";
  if (!encryptedToken) {
    throw new LinkedInIntegrationError("LinkedIn access token is required.", {
      code: "LINKEDIN_ACCESS_TOKEN_MISSING",
      accountStatus: "INVALID_CREDENTIALS",
    });
  }

  // Publish must fail closed when token storage is not encrypted.
  if (options?.requireEncrypted && !isEncryptedToken(encryptedToken)) {
    throw new LinkedInIntegrationError("LinkedIn access token must be encrypted for live publish.", {
      code: "LINKEDIN_ACCESS_TOKEN_NOT_ENCRYPTED",
      accountStatus: "INVALID_CREDENTIALS",
    });
  }

  // Validation/migration paths keep controlled plaintext compatibility.
  const accessToken = await decryptToken(encryptedToken);
  if (!accessToken) {
    throw new LinkedInIntegrationError("LinkedIn access token decryption failed.", {
      code: "LINKEDIN_ACCESS_TOKEN_DECRYPTION_FAILED",
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
  const authorUrn = requireLinkedInAuthorUrn(account);
  const scopes = parseLinkedInScopes(account);
  const isMemberAuthor = authorUrn.startsWith("urn:li:person:");
  const isOrganizationAuthor = authorUrn.startsWith("urn:li:organization:");

  if (!isMemberAuthor && !isOrganizationAuthor) {
    throw new LinkedInIntegrationError("LinkedIn author URN is invalid for publish.", {
      code: "LINKEDIN_AUTHOR_URN_INVALID",
      accountStatus: "INVALID_CREDENTIALS",
    });
  }

  if (isMemberAuthor && !scopes.has(LINKEDIN_MEMBER_SCOPE)) {
    throw new LinkedInIntegrationError("LinkedIn member publish scope is missing.", {
      code: "LINKEDIN_SCOPE_MISSING_W_MEMBER_SOCIAL",
      accountStatus: "INVALID_CREDENTIALS",
    });
  }

  if (isOrganizationAuthor) {
    if (!scopes.has(LINKEDIN_ORGANIZATION_SCOPE)) {
      throw new LinkedInIntegrationError("LinkedIn organization publish scope is missing.", {
        code: "LINKEDIN_SCOPE_MISSING_W_ORGANIZATION_SOCIAL",
        accountStatus: "INVALID_CREDENTIALS",
      });
    }

    const organizationRole = resolveOrganizationRole(account);
    if (!organizationRole || !LINKEDIN_ALLOWED_ORGANIZATION_ROLES.has(organizationRole)) {
      throw new LinkedInIntegrationError("LinkedIn organization role is missing for publish.", {
        code: "LINKEDIN_ORGANIZATION_ROLE_MISSING",
        accountStatus: "INVALID_CREDENTIALS",
      });
    }
  }

  return publishLinkedInMemberPost({
    accessToken: await requireLinkedInAccessToken(account, { requireEncrypted: true }),
    authorUrn,
    content,
  });
}

export async function validateRuntimeLinkedInAccount(account: RuntimeSocialAccount) {
  const authorUrn = typeof getLinkedInAuthMeta(account).authorUrn === "string"
    ? getLinkedInAuthMeta(account).authorUrn!.trim()
    : "";
  const scopes = parseLinkedInScopes(account);

  if (authorUrn.startsWith("urn:li:organization:")) {
    if (!scopes.has(LINKEDIN_ORGANIZATION_SCOPE)) {
      throw new LinkedInIntegrationError("LinkedIn organization publish scope is missing.", {
        code: "LINKEDIN_SCOPE_MISSING_W_ORGANIZATION_SOCIAL",
        accountStatus: "INVALID_CREDENTIALS",
      });
    }
  } else if (!scopes.has(LINKEDIN_MEMBER_SCOPE)) {
    throw new LinkedInIntegrationError("LinkedIn member publish scope is missing.", {
      code: "LINKEDIN_SCOPE_MISSING_W_MEMBER_SOCIAL",
      accountStatus: "INVALID_CREDENTIALS",
    });
  }

  return verifyLinkedInAccess(await requireLinkedInAccessToken(account, { requireEncrypted: false }));
}
