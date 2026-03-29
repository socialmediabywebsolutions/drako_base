import { normalizeHost, resolveHostMode, type HostMode } from "@/lib/hosts";

export type PlatformSurface =
  | "holding_admin"
  | "tenant_workspace"
  | "tenant_workspace_api"
  | "public_onboarding"
  | "public_site"
  | "auth_api"
  | "unknown";

export type TenantWorkspaceEntryMode = "holding_operator" | "product_operator" | "local_demo";

export type ChildSaasWorkspaceKind = "owned_saas" | "client_saas";

const HOLDING_ADMIN_PREFIXES = [
  "/admin",
  "/agents",
  "/departments",
  "/metrics",
  "/alerts",
  "/operator",
  "/owner",
  "/saas",
  "/inbox",
  "/dev-architects",
  "/grants",
  "/clients",
  "/clinic",
  "/billing",
  "/staff",
  "/site/panel",
];

const TENANT_WORKSPACE_PREFIXES = ["/socialflow"];

const TENANT_WORKSPACE_API_PREFIXES = [
  "/api/socialflow",
  "/api/social",
  "/api/mentoria",
];

function matchesPrefix(pathname: string, prefix: string): boolean {
  return pathname === prefix || pathname.startsWith(`${prefix}/`);
}

export function isHoldingAdminPath(pathname: string): boolean {
  return HOLDING_ADMIN_PREFIXES.some((prefix) => matchesPrefix(pathname, prefix));
}

export function isTenantWorkspacePath(pathname: string): boolean {
  if (pathname.startsWith("/socialflow/auth")) return false;
  return TENANT_WORKSPACE_PREFIXES.some((prefix) => matchesPrefix(pathname, prefix));
}

export function isTenantWorkspaceApiPath(pathname: string): boolean {
  return TENANT_WORKSPACE_API_PREFIXES.some((prefix) => matchesPrefix(pathname, prefix));
}

export function isPublicOnboardingPath(pathname: string): boolean {
  return matchesPrefix(pathname, "/site/onboarding");
}

export function isAuthApiPath(pathname: string): boolean {
  return (
    matchesPrefix(pathname, "/api/drakos/auths")
    || matchesPrefix(pathname, "/api/mentorias/auths")
    || matchesPrefix(pathname, "/api/socialflow/auths")
    || matchesPrefix(pathname, "/api/bases/auths")
  );
}

export function shouldEnableNextAuthClient(pathname: string): boolean {
  return matchesPrefix(pathname, "/site/panel") || isPublicOnboardingPath(pathname);
}

export function resolvePlatformSurfaceFromPath(pathname: string): PlatformSurface {
  if (isAuthApiPath(pathname)) return "auth_api";
  if (isTenantWorkspaceApiPath(pathname)) return "tenant_workspace_api";
  if (isTenantWorkspacePath(pathname)) return "tenant_workspace";
  if (isHoldingAdminPath(pathname)) return "holding_admin";
  if (isPublicOnboardingPath(pathname)) return "public_onboarding";
  if (pathname === "/" || pathname.startsWith("/site") || pathname.startsWith("/auth")) return "public_site";
  return "unknown";
}

export function isLocalDemoEnabled(): boolean {
  return (
    typeof process !== "undefined"
    && process.env.NODE_ENV !== "production"
    && process.env.DRAKO_ENABLE_DEMO_SESSION !== "0"
  );
}

export function isLocalDemoClientBypassRequest(params: {
  pathname: string;
  requestedHost: string | null | undefined;
}): boolean {
  const host = normalizeHost(params.requestedHost ?? "");
  return (
    isLocalDemoEnabled()
    && isTenantWorkspacePath(params.pathname)
    && Boolean(host && (host === "localhost" || host === "127.0.0.1"))
  );
}

export function resolveTenantWorkspaceEntryMode(params: {
  pathname: string;
  effectiveHost: string | null | undefined;
  pagesEnvironment?: string | null | undefined;
  localDemoEnabled?: boolean;
}): TenantWorkspaceEntryMode | null {
  const surface = resolvePlatformSurfaceFromPath(params.pathname);
  if (surface !== "tenant_workspace" && surface !== "tenant_workspace_api") {
    return null;
  }
  if (params.localDemoEnabled) {
    return "local_demo";
  }
  const host = normalizeHost(params.effectiveHost ?? "");
  const hostMode: HostMode = resolveHostMode(host, params.pagesEnvironment ?? null);
  if (hostMode === "CAMPAMENTO_BASE") {
    return "holding_operator";
  }
  return "product_operator";
}

export function resolveChildSaasWorkspaceKind(params: {
  clientSaasId?: string | null;
}): ChildSaasWorkspaceKind {
  return params.clientSaasId ? "client_saas" : "owned_saas";
}
