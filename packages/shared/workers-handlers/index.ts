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
  handleRequest: (request: Request) => Promise<Response>;
}

/**
 * Creates a workers handler with the given configuration
 */
export function createWorkersHandlers(config: WorkersHandlersConfig): WorkersHandler {
  return {
    config,
    handleRequest: async (request: Request): Promise<Response> => {
      try {
        // Validate request origin
        const origin = request.headers.get("origin");
        if (!origin || !isValidOrigin(origin, config.domainName, config.aliasDomainNames)) {
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
    },
  };
}

/**
 * Validates if the origin is allowed for this domain
 */
function isValidOrigin(origin: string, domainName: string, aliasDomainNames?: string[]): boolean {
  try {
    const url = new URL(origin);
    const hostname = url.hostname;
    
    // Check primary domain
    if (hostname === domainName || hostname === `*.${domainName}`) {
      return true;
    }
    
    // Check alias domains
    if (aliasDomainNames) {
      for (const aliasDomain of aliasDomainNames) {
        if (hostname === aliasDomain || hostname === `*.${aliasDomain}`) {
          return true;
        }
      }
    }
    
    return false;
  } catch {
    return false;
  }
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
