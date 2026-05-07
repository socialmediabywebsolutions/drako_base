/**
 * Workers Handlers - Shared utilities for Cloudflare Workers
 * Provides factory function for creating worker request handlers
 */

export interface WorkersHandlersConfig {
  saasSlug: string;
  workerName: string;
  domainName: string;
  aliasDomainNames?: string[];
  authsSecretName: string;
  allSaasesSlugs: string[];
}

export interface WorkersHandler {
  config: WorkersHandlersConfig;
  handleRequest: (request: Request, runtimeEnv?: WorkersRuntimeEnv) => Promise<Response>;
  fetch: (request: Request, runtimeEnv?: WorkersRuntimeEnv) => Promise<Response>;
}

/**
 * Creates a workers handler with the given configuration
 */
export function createWorkersHandlers(config: WorkersHandlersConfig): WorkersHandler {
  const fallbackAllowedHostNames = [config.domainName, ...(config.aliasDomainNames ?? [])];

  const handleRequest = async (request: Request, runtimeEnv?: WorkersRuntimeEnv): Promise<Response> => {
    const requestedHostName = resolveRequestedHostName(request);
    const allowedHostNames = parseAllowedHostNames(runtimeEnv?.SAASES_DOMAIN, fallbackAllowedHostNames);
    if (!requestedHostName || !allowedHostNames.includes(requestedHostName)) {
      return new Response(
        JSON.stringify(
          {
            ok: false,
            errorCode: "HOSTS_FENCING_REJECTED",
            workerName: config.workerName,
            requestedHostName,
            allowedHostNames,
          },
          null,
          2,
        ),
        {
          status: 403,
          headers: { "Content-Type": "application/json" },
        },
      );
    }

    try {
      // Validate request origin
      const origin = request.headers.get("origin");
      if (!origin || !isValidOrigin(origin, allowedHostNames)) {
        return new Response(JSON.stringify({ error: "Unauthorized origin" }), {
          status: 403,
          headers: { "Content-Type": "application/json" },
        });
      }

      // Route request based on worker name
      switch (config.workerName) {
        case "analytics":
          return handleAnalyticsRequest(request, config);
        case "automations":
          return handleAutomationsRequest(request, config);
        case "bases":
          return handleBasesRequest(request, config);
        case "cryptos":
          return handleCryptosRequest(request, config);
        case "invoices":
          return handleInvoicesRequest(request, config);
        case "socialflows":
        case "saas-socialflows-prod":
          return handleSocialflowsRequest(request, config);
        default:
          return new Response(JSON.stringify({ error: "Unknown worker" }), {
            status: 400,
            headers: { "Content-Type": "application/json" },
          });
      }
    } catch (error) {
      console.error(`[${config.workerName}] Request handler error:`, error);
      return new Response(JSON.stringify({ error: "Internal server error" }), {
        status: 500,
        headers: { "Content-Type": "application/json" },
      });
    }
  };

  return {
    config,
    handleRequest,
    fetch: handleRequest,
  };
}

/**
 * Validates if the origin is allowed for this domain
 */
function isValidOrigin(origin: string, allowedHostNames: string[]): boolean {
  try {
    const url = new URL(origin);
    const hostname = normalizeHostName(url.hostname);
    return allowedHostNames.includes(hostname);
  } catch {
    return false;
  }
}

export type WorkersRuntimeEnv = {
  SAASES_DOMAIN?: string;
};

function normalizeHostName(value: string): string {
  const normalized = value.trim().toLowerCase();
  if (!normalized) return "";
  const withoutProtocol = normalized.replace(/^[a-z]+:\/\//, "");
  const hostWithOptionalPort = withoutProtocol.split(/[/?#]/)[0] ?? "";
  const hostWithoutPort = hostWithOptionalPort.split(":")[0] ?? "";
  return hostWithoutPort.replace(/^www\./, "").replace(/\.+$/, "");
}

function uniqueHostNames(values: string[]): string[] {
  return Array.from(new Set(values));
}

function normalizeHostNameTokens(values: string[]): string[] {
  return uniqueHostNames(
    values
      .map((value) => normalizeHostName(value))
      .filter((value) => value.length > 0 && !value.includes("*")),
  );
}

function readHostNameFromRequest(request: Request, headerName: string): string {
  const rawValue = request.headers.get(headerName) ?? "";
  const firstValue = rawValue.split(",")[0] ?? "";
  return normalizeHostName(firstValue);
}

export function resolveRequestedHostName(request: Request): string {
  const forwardedHostName = readHostNameFromRequest(request, "x-forwarded-host");
  if (forwardedHostName) return forwardedHostName;
  const headerHostName = readHostNameFromRequest(request, "host");
  if (headerHostName) return headerHostName;
  try {
    return normalizeHostName(new URL(request.url).hostname);
  } catch {
    return "";
  }
}

export function parseAllowedHostNames(
  rawValue: string | undefined,
  fallbackHostNames: string[],
): string[] {
  const parsedFromEnv = normalizeHostNameTokens((rawValue ?? "").split(/[,\s]+/g));
  if (parsedFromEnv.length > 0) return parsedFromEnv;
  return normalizeHostNameTokens(fallbackHostNames);
}

/**
 * Handler for analytics worker requests
 */
async function handleAnalyticsRequest(request: Request, config: WorkersHandlersConfig): Promise<Response> {
  if (request.method === "POST") {
    const body = await request.json();
    return new Response(JSON.stringify({ success: true, worker: "analytics", saas: config.saasSlug }), {
      status: 200,
      headers: { "Content-Type": "application/json" },
    });
  }
  return new Response(JSON.stringify({ error: "Method not allowed" }), { status: 405 });
}

/**
 * Handler for automations worker requests
 */
async function handleAutomationsRequest(request: Request, config: WorkersHandlersConfig): Promise<Response> {
  if (request.method === "POST") {
    const body = await request.json();
    return new Response(JSON.stringify({ success: true, worker: "automations", saas: config.saasSlug }), {
      status: 200,
      headers: { "Content-Type": "application/json" },
    });
  }
  return new Response(JSON.stringify({ error: "Method not allowed" }), { status: 405 });
}

/**
 * Handler for bases worker requests
 */
async function handleBasesRequest(request: Request, config: WorkersHandlersConfig): Promise<Response> {
  if (request.method === "POST") {
    const body = await request.json();
    return new Response(JSON.stringify({ success: true, worker: "bases", saas: config.saasSlug }), {
      status: 200,
      headers: { "Content-Type": "application/json" },
    });
  }
  return new Response(JSON.stringify({ error: "Method not allowed" }), { status: 405 });
}

/**
 * Handler for cryptos worker requests
 */
async function handleCryptosRequest(request: Request, config: WorkersHandlersConfig): Promise<Response> {
  if (request.method === "POST") {
    const body = await request.json();
    return new Response(JSON.stringify({ success: true, worker: "cryptos", saas: config.saasSlug }), {
      status: 200,
      headers: { "Content-Type": "application/json" },
    });
  }
  return new Response(JSON.stringify({ error: "Method not allowed" }), { status: 405 });
}

/**
 * Handler for invoices worker requests
 */
async function handleInvoicesRequest(request: Request, config: WorkersHandlersConfig): Promise<Response> {
  if (request.method === "POST") {
    const body = await request.json();
    return new Response(JSON.stringify({ success: true, worker: "invoices", saas: config.saasSlug }), {
      status: 200,
      headers: { "Content-Type": "application/json" },
    });
  }
  return new Response(JSON.stringify({ error: "Method not allowed" }), { status: 405 });
}

/**
 * Handler for socialflows worker requests
 */
async function handleSocialflowsRequest(request: Request, config: WorkersHandlersConfig): Promise<Response> {
  if (request.method === "POST") {
    const body = await request.json();
    return new Response(JSON.stringify({ success: true, worker: "socialflows", saas: config.saasSlug }), {
      status: 200,
      headers: { "Content-Type": "application/json" },
    });
  }
  return new Response(JSON.stringify({ error: "Method not allowed" }), { status: 405 });
}

export default createWorkersHandlers;
