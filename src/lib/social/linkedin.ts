/**
 * @deprecated Import LinkedIn primitives from "@/lib/socialflow/linkedin/core".
 * This file remains as a legacy compatibility facade while SocialFlow
 * LinkedIn is verticalized under src/lib/socialflow/linkedin.
 */
export {
  LinkedInIntegrationError,
  exchangeLinkedInCodeForAccessToken,
  fetchLinkedInUserProfile,
  parseLinkedInOAuthState,
  publishLinkedInMemberPost,
  resolveLinkedInCallback,
  resolveLinkedInCallbackUrl,
  resolveLinkedInIdentity,
  resolveLinkedInOAuthDiagnostics,
  verifyLinkedInAccess,
} from "@/lib/socialflow/linkedin/core";

export type {
  LinkedInCallbackOptions,
  LinkedInCallbackResolution,
  LinkedInErrorStatus,
  LinkedInOAuthDiagnostics,
  LinkedInOAuthState,
  LinkedInPublishPostInput,
  LinkedInPublishPostResult,
  LinkedInResolvedIdentity,
  LinkedInRuntimeKind,
  LinkedInTokenResponse,
  LinkedInUserProfile,
} from "@/lib/socialflow/linkedin/core";
