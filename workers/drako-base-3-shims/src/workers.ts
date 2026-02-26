type LegacyShimsEnv = {
  CORE_SERVICE?: Fetcher;
  BILLING_SERVICE?: Fetcher;
  OBSERVABILITY_SERVICE?: Fetcher;
  AI_ORCHESTRATOR_SERVICE?: Fetcher;
  CORE_WORKER_URL?: string;
  BILLING_WORKER_URL?: string;
  OBSERVABILITY_WORKER_URL?: string;
  AI_ORCHESTRATOR_WORKER_URL?: string;
  LEGACY_ALLOWED_HOST_NAMES?: string;
  SUNSETS_MODE?: string;
  WORKERS_ONLY_MODE?: string;
  CF_PAGES?: string;
  CF_PAGES_ENVIRONMENT?: string;
  CF_PAGES_URL?: string;
};

type RouteMappings = {
  prefix: string;
  targetService: keyof LegacyShimsEnv;
  targetBaseUrl: keyof LegacyShimsEnv;
  stripPrefix: boolean;
};

const MAPPINGS: RouteMappings[] = [
  { prefix: "/registry/", targetService: "CORE_SERVICE", targetBaseUrl: "CORE_WORKER_URL", stripPrefix: false },
  { prefix: "/governance/", targetService: "CORE_SERVICE", targetBaseUrl: "CORE_WORKER_URL", stripPrefix: false },
  { prefix: "/audit/", targetService: "CORE_SERVICE", targetBaseUrl: "CORE_WORKER_URL", stripPrefix: false },
  { prefix: "/loop/", targetService: "CORE_SERVICE", targetBaseUrl: "CORE_WORKER_URL", stripPrefix: false },
  { prefix: "/billing/", targetService: "BILLING_SERVICE", targetBaseUrl: "BILLING_WORKER_URL", stripPrefix: true },
  { prefix: "/observability/", targetService: "OBSERVABILITY_SERVICE", targetBaseUrl: "OBSERVABILITY_WORKER_URL", stripPrefix: true },
  { prefix: "/ai/", targetService: "AI_ORCHESTRATOR_SERVICE", targetBaseUrl: "AI_ORCHESTRATOR_WORKER_URL", stripPrefix: true },
];

function detectPagesExecutions(env: LegacyShimsEnv): boolean {
  return env.CF_PAGES === "1" || Boolean(env.CF_PAGES_ENVIRONMENT) || Boolean(env.CF_PAGES_URL);
}

function buildJsonResponses(payload: unknown, status = 200): Response {
  return new Response(JSON.stringify(payload, null, 2), {
    status,
    headers: {
      "content-type": "application/json; charset=utf-8",
      "cache-control": "no-store",
    },
  });
}

function readHostNames(request: Request): string {
  const forwardedHost = request.headers.get("x-forwarded-host") ?? "";
  const hostHeader = request.headers.get("host") ?? "";
  const hostValue = forwardedHost || hostHeader;
  return hostValue.split(",")[0]?.trim().toLowerCase() ?? "";
}

function parseAllowedHostNames(env: LegacyShimsEnv): Set<string> {
  const raw = env.LEGACY_ALLOWED_HOST_NAMES ?? "drako-base-3.socialmediabywebsolutions.workers.dev";
  const parts = raw
    .split(",")
    .map((item) => item.trim().toLowerCase())
    .filter(Boolean);
  return new Set(parts);
}

function normalizeTargetBaseUrl(value: string | undefined): string | null {
  if (!value) return null;
  try {
    const parsed = new URL(value);
    if (!/^https:$/.test(parsed.protocol)) return null;
    return parsed.origin;
  } catch {
    return null;
  }
}

function readFetchers(env: LegacyShimsEnv, keyName: keyof LegacyShimsEnv): Fetcher | null {
  const value = env[keyName];
  if (value && typeof value === "object" && "fetch" in value && typeof value.fetch === "function") {
    return value as Fetcher;
  }
  return null;
}

function resolveMappings(pathName: string): RouteMappings | null {
  for (const mapping of MAPPINGS) {
    if (pathName.startsWith(mapping.prefix)) return mapping;
    const withoutTrailingSlash = mapping.prefix.endsWith("/") ? mapping.prefix.slice(0, -1) : mapping.prefix;
    if (pathName === withoutTrailingSlash) return mapping;
  }
  return null;
}

function buildForwardPathNames(pathName: string, mapping: RouteMappings): string {
  if (!mapping.stripPrefix) return pathName;
  const withoutPrefix = pathName.slice(mapping.prefix.length - 1);
  return withoutPrefix.startsWith("/") ? withoutPrefix : `/${withoutPrefix}`;
}

function buildForwardRequest(request: Request, targetUrl: string): Request {
  const headers = new Headers(request.headers);
  headers.set("x-drko-legacy-shim", "drako-base-3");
  headers.set("x-drko-legacy-forwarded-at", new Date().toISOString());
  return new Request(targetUrl, {
    method: request.method,
    headers,
    body: request.method === "GET" || request.method === "HEAD" ? undefined : request.body,
    redirect: "manual",
  });
}

async function probeHealths(params: {
  targetBaseUrl: string | null;
  serviceFetcher: Fetcher | null;
}): Promise<Record<string, unknown>> {
  if (!params.targetBaseUrl && !params.serviceFetcher) {
    return { ok: false, errorCode: "TARGETS_URLS_MISSINGS" };
  }

  try {
    const response = params.serviceFetcher
      ? await params.serviceFetcher.fetch("https://internal.drako/healths", {
          method: "GET",
          headers: { "cache-control": "no-store" },
        })
      : await fetch(`${params.targetBaseUrl}/healths`, {
          method: "GET",
          headers: { "cache-control": "no-store" },
        });
    const text = await response.text();
    let payload: unknown = null;
    try {
      payload = text ? JSON.parse(text) : null;
    } catch {
      payload = { raw: text };
    }
    return {
      ok: response.ok,
      status: response.status,
      payload,
    };
  } catch (error) {
    return {
      ok: false,
      errorCode: "TARGETS_HEALTHS_REQUESTS_FAILED",
      message: error instanceof Error ? error.message : String(error),
    };
  }
}

export default {
  async fetch(request: Request, env: LegacyShimsEnv): Promise<Response> {
    if (detectPagesExecutions(env)) {
      return buildJsonResponses(
        {
          ok: false,
          errorCode: "WORKERS_ONLY_ENFORCEMENTS",
          message: "drako-base-3 shim must run on Workers runtime only.",
        },
        503,
      );
    }

    const requestUrl = new URL(request.url);
    const methodName = request.method.toUpperCase();
    const pathName = requestUrl.pathname;
    const hostName = readHostNames(request);
    const allowedHostNames = parseAllowedHostNames(env);

    if (!allowedHostNames.has(hostName)) {
      return buildJsonResponses(
        {
          ok: false,
          errorCode: "LEGACY_HOSTS_FORBIDDENS",
          message: "drako-base-3 is in sunset mode and rejects foreign hosts.",
          hostName,
          allowedHostNames: Array.from(allowedHostNames),
        },
        403,
      );
    }

    const coreWorkerUrl = normalizeTargetBaseUrl(env.CORE_WORKER_URL);
    const billingWorkerUrl = normalizeTargetBaseUrl(env.BILLING_WORKER_URL);
    const observabilityWorkerUrl = normalizeTargetBaseUrl(env.OBSERVABILITY_WORKER_URL);
    const aiOrchestratorWorkerUrl = normalizeTargetBaseUrl(env.AI_ORCHESTRATOR_WORKER_URL);
    const coreService = readFetchers(env, "CORE_SERVICE");
    const billingService = readFetchers(env, "BILLING_SERVICE");
    const observabilityService = readFetchers(env, "OBSERVABILITY_SERVICE");
    const aiOrchestratorService = readFetchers(env, "AI_ORCHESTRATOR_SERVICE");

    if (methodName === "GET" && pathName === "/healths") {
      const [coreHealths, billingHealths, observabilityHealths, aiHealths] = await Promise.all([
        probeHealths({ targetBaseUrl: coreWorkerUrl, serviceFetcher: coreService }),
        probeHealths({ targetBaseUrl: billingWorkerUrl, serviceFetcher: billingService }),
        probeHealths({ targetBaseUrl: observabilityWorkerUrl, serviceFetcher: observabilityService }),
        probeHealths({ targetBaseUrl: aiOrchestratorWorkerUrl, serviceFetcher: aiOrchestratorService }),
      ]);

      return buildJsonResponses({
        ok: true,
        workerName: "drako-base-3",
        mode: env.SUNSETS_MODE ?? "true",
        workersOnly: true,
        hostName,
        route: "/healths",
        upstreams: {
          core: coreHealths,
          billing: billingHealths,
          observability: observabilityHealths,
          ai_orchestrator: aiHealths,
        },
      });
    }

    const mapping = resolveMappings(pathName);
    if (!mapping) {
      return buildJsonResponses(
        {
          ok: false,
          errorCode: "LEGACY_ROUTES_SUNSETS",
          message: "drako-base-3 is deprecated. Route is not mapped in strangler shim.",
          pathName,
        },
        410,
      );
    }

    const targetBaseUrl = normalizeTargetBaseUrl(env[mapping.targetBaseUrl] as string | undefined);
    const serviceFetcher = readFetchers(env, mapping.targetService);
    if (!targetBaseUrl && !serviceFetcher) {
      return buildJsonResponses(
        {
          ok: false,
          errorCode: "TARGETS_URLS_MISSINGS",
          message: `Missing or invalid target URL for ${mapping.targetBaseUrl}.`,
        },
        502,
      );
    }

    const forwardPathName = buildForwardPathNames(pathName, mapping);
    const forwardUrl = new URL(request.url);
    if (targetBaseUrl) {
      forwardUrl.host = new URL(targetBaseUrl).host;
      forwardUrl.protocol = "https:";
    } else {
      forwardUrl.host = "internal.drako";
      forwardUrl.protocol = "https:";
    }
    forwardUrl.pathname = forwardPathName;

    const forwardedRequest = buildForwardRequest(request, forwardUrl.toString());
    const response = serviceFetcher ? await serviceFetcher.fetch(forwardedRequest) : await fetch(forwardedRequest);
    return new Response(response.body, response);
  },
};
