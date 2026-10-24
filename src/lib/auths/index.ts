/**
 * Public API for the minimum auth/tenant isolation contract.
 *
 * Canonized minimum surface:
 * - types
 * - contexts
 * - cookies
 * - ssot
 *
 * Compatibility exports remain available below for current consumers, but they
 * are outside the minimum canonized surface in this phase.
 *
 * Intentionally outside this barrel:
 * - http helpers
 * - repositories
 * - services
 * - origin resolution
 * - middleware/runtime session wiring
 * - local demo and legacy compatibility paths
 */

// Minimum canonized auth/tenant contract: types
export type {
  AuthsContext,
  AuthsRole,
  AuthsCookieSameSite,
  AuthsCookieConfig,
  AuthsSaasSlug,
  AuthsSessionClaims,
  TelemetriesEventName,
  TelemetriesEvent,
} from "@/lib/auths/types";

// Minimum canonized auth/tenant contract: context resolution
export {
  resolveAuthsContextFromHost,
  resolveAuthsContextFromPath,
  resolveAuthsContextFromRequest,
  resolveLegacyAuthsContext,
  resolveAuthsLoginPath,
} from "@/lib/auths/contexts";

// Minimum canonized auth/tenant contract: cookie naming/config
export {
  AUTHS_COOKIE_MAX_AGE_SECONDS,
  AUTHS_COOKIE_CONFIGS,
  getAuthsCookieConfig,
  getAuthsCookieName,
  readCookieFromHeader,
} from "@/lib/auths/cookies";

// Minimum canonized auth/tenant contract: boundary enforcement
export type { AuthBoundaryValidation } from "@/lib/auths/ssot";
export {
  AUTHS_BOUNDARY_MISMATCH_CODE,
  resolveSaasSlugForAuthContext,
  resolveExpectedAuthsContextForEndpoint,
  validateAuthBoundary,
  enforceAuthBoundary,
} from "@/lib/auths/ssot";

// Compatibility exports outside the minimum canonized surface
export {
  isAuthsIsolationEnabled,
  isAuthsLegacyCompatEnabled,
  isAuthsLegacyRegisterEnabled,
  isRoutingsSubdomainsEnabled,
  isTelemetriesHoldingEnabled,
  isAuthsContextDbRequired,
} from "@/lib/auths/flags";

export {
  getTokenIssuer,
  getTokenAudience,
  createAuthsSessionToken,
  verifyAuthsSessionToken,
} from "@/lib/auths/tokens";

export {
  drakosAuthsFactory,
  mentoriasAuthsFactory,
  socialflowAuthsFactory,
} from "@/lib/auths/factories";

export { drakosAuths } from "@/lib/auths/drakos-auths";
export { mentoriasAuths } from "@/lib/auths/mentorias-auths";
export { rejectFinalUserAuthOnBase } from "@/lib/auths/bases-auths";
