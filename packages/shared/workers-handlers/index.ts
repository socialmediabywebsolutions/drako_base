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
      // Check if this is a public route that doesn't require Origin validation
      const url = new URL(request.url);
      const isPublicRoute = isPublicRouteForWorker(url.pathname, config.workerName, request.method);

      // Validate request origin for non-public routes
      if (!isPublicRoute) {
        const origin = request.headers.get("origin");
        if (!origin || !isValidOrigin(origin, allowedHostNames)) {
          return new Response(JSON.stringify({ error: "Unauthorized origin" }), {
            status: 403,
            headers: { "Content-Type": "application/json" },
          });
        }
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
 * Checks if a route is public and doesn't require Origin validation
 */
function isPublicRouteForWorker(pathname: string, workerName: string, method: string): boolean {
  // Only SocialFlow worker has public routes
  if (workerName !== "socialflows" && workerName !== "saas-socialflows-prod") {
    return false;
  }

  // Only GET requests can be public
  if (method !== "GET") {
    return false;
  }

  // Public routes for SocialFlow
  const publicRoutes = ["/", "/socialflow", "/socialflow/auth"];
  return publicRoutes.includes(pathname);
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
 * Generates public HTML landing page for SocialFlow
 */
function generateSocialFlowPublicHTML(): string {
  return `<!DOCTYPE html>
<html lang="es">
<head>
  <meta charset="UTF-8">
  <meta name="viewport" content="width=device-width, initial-scale=1.0">
  <title>SocialFlow - Automatización social asistida por IA</title>
  <style>
    * { margin: 0; padding: 0; box-sizing: border-box; }
    body {
      font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, 'Helvetica Neue', Arial, sans-serif;
      background: linear-gradient(135deg, #0f172a 0%, #1e293b 100%);
      color: #f1f5f9;
      line-height: 1.6;
      min-height: 100vh;
      display: flex;
      flex-direction: column;
    }
    .container {
      max-width: 1200px;
      margin: 0 auto;
      padding: 2rem;
      flex: 1;
    }
    header {
      text-align: center;
      padding: 3rem 0;
      border-bottom: 1px solid rgba(241, 245, 249, 0.1);
    }
    .logo {
      font-size: 0.875rem;
      font-weight: 600;
      letter-spacing: 0.1em;
      text-transform: uppercase;
      color: #06b6d4;
      margin-bottom: 1rem;
    }
    h1 {
      font-size: 2.5rem;
      font-weight: 700;
      margin-bottom: 1rem;
      background: linear-gradient(to right, #f1f5f9, #cbd5e1);
      -webkit-background-clip: text;
      -webkit-text-fill-color: transparent;
      background-clip: text;
    }
    .subtitle {
      font-size: 1.25rem;
      color: #94a3b8;
      margin-bottom: 2rem;
    }
    .description {
      font-size: 1.125rem;
      color: #cbd5e1;
      max-width: 800px;
      margin: 0 auto 1rem;
    }
    .pilot-badge {
      display: inline-block;
      background: rgba(6, 182, 212, 0.1);
      border: 1px solid rgba(6, 182, 212, 0.3);
      color: #06b6d4;
      padding: 0.5rem 1rem;
      border-radius: 2rem;
      font-size: 0.875rem;
      font-weight: 600;
      margin-top: 1rem;
    }
    .features {
      display: grid;
      grid-template-columns: repeat(auto-fit, minmax(250px, 1fr));
      gap: 2rem;
      margin: 4rem 0;
    }
    .feature {
      background: rgba(241, 245, 249, 0.05);
      border: 1px solid rgba(241, 245, 249, 0.1);
      border-radius: 1rem;
      padding: 2rem;
      transition: all 0.3s ease;
    }
    .feature:hover {
      background: rgba(241, 245, 249, 0.08);
      border-color: rgba(6, 182, 212, 0.3);
      transform: translateY(-4px);
    }
    .feature h3 {
      font-size: 1.25rem;
      margin-bottom: 0.75rem;
      color: #f1f5f9;
    }
    .feature p {
      color: #94a3b8;
      font-size: 0.95rem;
    }
    .cta-section {
      text-align: center;
      padding: 3rem 0;
      border-top: 1px solid rgba(241, 245, 249, 0.1);
    }
    .cta-button {
      display: inline-block;
      background: #06b6d4;
      color: #0f172a;
      padding: 1rem 2rem;
      border-radius: 0.5rem;
      text-decoration: none;
      font-weight: 600;
      font-size: 1.125rem;
      transition: all 0.3s ease;
      margin: 0.5rem;
    }
    .cta-button:hover {
      background: #0891b2;
      transform: translateY(-2px);
      box-shadow: 0 10px 25px rgba(6, 182, 212, 0.3);
    }
    .cta-button.secondary {
      background: rgba(241, 245, 249, 0.1);
      color: #f1f5f9;
      border: 1px solid rgba(241, 245, 249, 0.2);
    }
    .cta-button.secondary:hover {
      background: rgba(241, 245, 249, 0.15);
    }
    footer {
      text-align: center;
      padding: 2rem;
      color: #64748b;
      font-size: 0.875rem;
      border-top: 1px solid rgba(241, 245, 249, 0.1);
    }
    footer a {
      color: #06b6d4;
      text-decoration: none;
    }
    footer a:hover {
      text-decoration: underline;
    }
    @media (max-width: 768px) {
      h1 { font-size: 2rem; }
      .subtitle { font-size: 1.125rem; }
      .features { grid-template-columns: 1fr; }
    }
  </style>
</head>
<body>
  <div class="container">
    <header>
      <div class="logo">SocialFlow</div>
      <h1>Automatización social asistida por IA para canales de contenido</h1>
      <p class="subtitle">Planifica, organiza y prepara publicaciones para marcas, negocios y proyectos con múltiples canales temáticos.</p>
      <p class="description">Actualmente en fase piloto controlada dentro del ecosistema Drako.</p>
      <span class="pilot-badge">Programa Piloto Abierto</span>
    </header>

    <section class="features">
      <div class="feature">
        <h3>Canales temáticos</h3>
        <p>Organiza tu contenido por temas, marcas o proyectos. Cada canal con su propia identidad y calendario.</p>
      </div>
      <div class="feature">
        <h3>Calendario y programación</h3>
        <p>Planifica semanas completas de contenido. Programa publicaciones y mantén una presencia constante.</p>
      </div>
      <div class="feature">
        <h3>LinkedIn y redes sociales</h3>
        <p>Conecta tus perfiles profesionales y distribuye contenido de forma coordinada.</p>
      </div>
      <div class="feature">
        <h3>Operación asistida por IA</h3>
        <p>Automatiza tareas repetitivas y enfócate en crear contenido de valor.</p>
      </div>
    </section>

    <section class="cta-section">
      <h2 style="margin-bottom: 1.5rem; font-size: 1.875rem;">Tu próximo mes de contenido puede quedar listo hoy</h2>
      <a href="https://drako.systems/contact" class="cta-button">Solicitar piloto</a>
      <a href="#" class="cta-button secondary">Acceso cliente: próximamente</a>
    </section>
  </div>

  <footer>
    <p>Parte del ecosistema <a href="https://drako.systems">Drako</a> · <a href="https://drako.systems/contact">Contacto</a></p>
  </footer>
</body>
</html>`;
}

/**
 * Handler for socialflows worker requests
 */
async function handleSocialflowsRequest(request: Request, config: WorkersHandlersConfig): Promise<Response> {
  const url = new URL(request.url);
  const pathname = url.pathname;

  // Handle public GET routes
  if (request.method === "GET") {
    const publicRoutes = ["/", "/socialflow", "/socialflow/auth"];
    if (publicRoutes.includes(pathname)) {
      return new Response(generateSocialFlowPublicHTML(), {
        status: 200,
        headers: {
          "Content-Type": "text/html;charset=UTF-8",
          "Cache-Control": "public, max-age=3600",
        },
      });
    }
  }

  // Handle API POST requests (non-public routes)
  if (request.method === "POST") {
    try {
      const body = await request.json();
      return new Response(JSON.stringify({ success: true, worker: "socialflows", saas: config.saasSlug }), {
        status: 200,
        headers: { "Content-Type": "application/json" },
      });
    } catch {
      return new Response(JSON.stringify({ error: "Invalid JSON body" }), {
        status: 400,
        headers: { "Content-Type": "application/json" },
      });
    }
  }

  return new Response(JSON.stringify({ error: "Method not allowed" }), { status: 405 });
}

export default createWorkersHandlers;
