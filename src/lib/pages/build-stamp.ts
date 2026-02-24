import type { DracoEnv } from "@/lib/cf";

export function getPagesBuildStamp(request: Request, correlationId: string, bindings: DracoEnv | null) {
  const pagesBranch = bindings?.CF_PAGES_BRANCH ?? process.env.CF_PAGES_BRANCH;
  const pagesCommitSha = bindings?.CF_PAGES_COMMIT_SHA ?? process.env.CF_PAGES_COMMIT_SHA;
  const pagesUrl = bindings?.CF_PAGES_URL ?? process.env.CF_PAGES_URL;
  const pagesBuildId = bindings?.CF_PAGES_BUILD_ID ?? process.env.CF_PAGES_BUILD_ID;
  const provisioningMode =
    bindings?.CLOUDFLARE_PROVISIONING_MODE ?? process.env.CLOUDFLARE_PROVISIONING_MODE ?? null;
  const requestUrl = request.url;
  const requestHost = request.headers.get("host") ?? "";

  return {
    gitSha: process.env.NEXT_PUBLIC_GIT_SHA ?? pagesCommitSha ?? "unknown",
    buildTime: process.env.NEXT_PUBLIC_BUILD_TIME ?? new Date().toISOString(),
    pages: {
      branch: pagesBranch ?? null,
      commitSha: pagesCommitSha ?? null,
      url: pagesUrl ?? null,
      buildId: pagesBuildId ?? null,
    },
    environment: {
      nodeEnv: process.env.NODE_ENV ?? null,
      provisioningMode,
      pagesEnvironment: bindings?.CF_PAGES_ENVIRONMENT ?? process.env.CF_PAGES_ENVIRONMENT ?? null,
    },
    bindings: {
      dracoDb: Boolean(bindings?.DRACO_DB),
    },
    request: {
      host: requestHost,
      url: requestUrl,
      hostMode: request.headers.get("x-drako-host-mode") ?? null,
    },
    correlationId,
  };
}
