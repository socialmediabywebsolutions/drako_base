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
  <meta name="description" content="SocialFlow es una plataforma SaaS de automatización social asistida por IA para planificar, preparar, organizar y coordinar contenido multicanal con revisión humana.">
  <title>SocialFlow - Plataforma SaaS de automatización social asistida por IA</title>
  <style>
    * { margin: 0; padding: 0; box-sizing: border-box; }
    :root {
      color-scheme: light;
      --ink: #0f172a;
      --muted: #64748b;
      --soft: #f8fbff;
      --line: rgba(15, 23, 42, 0.09);
      --card: rgba(255, 255, 255, 0.86);
      --cyan: #06b6d4;
      --teal: #0f766e;
      --blue: #2563eb;
      --petrol: #0f3d4a;
      --shadow: 0 24px 80px rgba(15, 23, 42, 0.12);
      --soft-shadow: 0 14px 40px rgba(15, 23, 42, 0.08);
    }
    html { scroll-behavior: smooth; }
    body {
      font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, 'Helvetica Neue', Arial, sans-serif;
      background:
        radial-gradient(circle at 10% 0%, rgba(103, 232, 249, 0.34), transparent 28rem),
        radial-gradient(circle at 88% 8%, rgba(147, 197, 253, 0.34), transparent 30rem),
        linear-gradient(180deg, #f8fbff 0%, #eef8fb 42%, #ffffff 100%);
      color: var(--ink);
      line-height: 1.6;
      min-height: 100vh;
      display: flex;
      flex-direction: column;
    }
    a { color: inherit; }
    .container {
      width: min(1180px, calc(100% - 32px));
      margin: 0 auto;
      flex: 1;
    }
    .nav {
      position: sticky;
      top: 0;
      z-index: 20;
      display: flex;
      align-items: center;
      justify-content: space-between;
      gap: 1rem;
      margin: 18px auto 0;
      padding: 0.85rem 1rem;
      color: #475569;
      background: rgba(255, 255, 255, 0.74);
      border: 1px solid var(--line);
      border-radius: 999px;
      backdrop-filter: blur(18px);
      box-shadow: 0 18px 50px rgba(15, 23, 42, 0.08);
    }
    .brand {
      display: inline-flex;
      align-items: center;
      gap: 0.6rem;
      font-size: 0.95rem;
      font-weight: 700;
      letter-spacing: 0.08em;
      text-transform: uppercase;
      color: #0f172a;
    }
    .brand-mark {
      width: 34px;
      height: 34px;
      border-radius: 12px;
      background: linear-gradient(135deg, #06b6d4, #2563eb);
      box-shadow: 0 10px 24px rgba(37, 99, 235, 0.25);
      position: relative;
      display: inline-block;
    }
    .brand-mark::before,
    .brand-mark::after {
      content: "";
      position: absolute;
      border-radius: 999px;
      background: rgba(255, 255, 255, 0.86);
    }
    .brand-mark::before {
      width: 16px;
      height: 5px;
      left: 8px;
      top: 10px;
    }
    .brand-mark::after {
      width: 10px;
      height: 5px;
      right: 8px;
      bottom: 9px;
    }
    .nav-links {
      display: flex;
      flex-wrap: wrap;
      gap: 0.25rem;
      font-size: 0.9rem;
      color: #64748b;
    }
    .nav-links a {
      text-decoration: none;
      padding: 0.55rem 0.8rem;
      border-radius: 999px;
    }
    .nav-links a:hover {
      color: #0f3d4a;
      background: rgba(6, 182, 212, 0.09);
    }
    header {
      position: relative;
      overflow: hidden;
      text-align: left;
      padding: 6.5rem 0 4.5rem;
    }
    .hero-grid {
      display: grid;
      grid-template-columns: minmax(0, 0.95fr) minmax(420px, 1.05fr);
      gap: 4rem;
      align-items: center;
    }
    .logo {
      display: inline-flex;
      align-items: center;
      gap: 0.5rem;
      font-size: 0.875rem;
      font-weight: 600;
      letter-spacing: 0.1em;
      text-transform: uppercase;
      color: #0f766e;
      margin-bottom: 1rem;
      background: rgba(255, 255, 255, 0.78);
      border: 1px solid rgba(6, 182, 212, 0.22);
      border-radius: 999px;
      padding: 0.45rem 0.75rem;
      box-shadow: 0 10px 30px rgba(6, 182, 212, 0.12);
    }
    h1 {
      font-size: clamp(3rem, 6vw, 5.7rem);
      line-height: 0.92;
      letter-spacing: -0.075em;
      font-weight: 850;
      margin-bottom: 1.25rem;
      color: #071827;
    }
    .accent-text {
      background: linear-gradient(135deg, #0f766e, #06b6d4 44%, #2563eb);
      -webkit-background-clip: text;
      -webkit-text-fill-color: transparent;
      background-clip: text;
    }
    .subtitle {
      font-size: clamp(1.12rem, 2vw, 1.35rem);
      color: #475569;
      margin-bottom: 1.5rem;
      max-width: 700px;
    }
    .description {
      font-size: 1.03rem;
      color: #64748b;
      max-width: 720px;
      margin: 0 0 1rem;
    }
    .pilot-badge {
      display: inline-flex;
      align-items: center;
      gap: 0.5rem;
      background: #ecfeff;
      border: 1px solid rgba(6, 182, 212, 0.28);
      color: #0f766e;
      padding: 0.5rem 1rem;
      border-radius: 2rem;
      font-size: 0.875rem;
      font-weight: 600;
      margin-top: 1rem;
    }
    .pilot-badge::before {
      content: "";
      width: 8px;
      height: 8px;
      border-radius: 999px;
      background: #10b981;
      box-shadow: 0 0 0 6px rgba(16, 185, 129, 0.12);
    }
    .hero-actions {
      display: flex;
      flex-wrap: wrap;
      gap: 0.85rem;
      margin-top: 1.75rem;
    }
    .hero-proof {
      display: grid;
      grid-template-columns: repeat(3, minmax(0, 1fr));
      gap: 0.8rem;
      margin-top: 2rem;
      max-width: 700px;
    }
    .proof-card {
      background: rgba(255, 255, 255, 0.7);
      border: 1px solid var(--line);
      border-radius: 1.2rem;
      padding: 0.9rem;
      box-shadow: var(--soft-shadow);
    }
    .proof-card strong {
      display: block;
      color: #0f172a;
      font-size: 0.92rem;
    }
    .proof-card span {
      display: block;
      color: #64748b;
      font-size: 0.8rem;
      margin-top: 0.2rem;
    }
    .product-visual {
      position: relative;
      min-height: 620px;
    }
    .visual-glow {
      position: absolute;
      inset: 7% 4% 4% 8%;
      background: radial-gradient(circle at 45% 42%, rgba(6, 182, 212, 0.3), transparent 32rem);
      filter: blur(8px);
    }
    .dashboard-mockup {
      position: relative;
      background: rgba(255, 255, 255, 0.92);
      border: 1px solid rgba(15, 23, 42, 0.1);
      border-radius: 2rem;
      overflow: hidden;
      box-shadow: var(--shadow);
      transform: rotate(1.2deg);
    }
    .browser-bar {
      display: flex;
      align-items: center;
      justify-content: space-between;
      gap: 1rem;
      padding: 1rem 1.15rem;
      background: linear-gradient(180deg, #ffffff, #f8fafc);
      border-bottom: 1px solid var(--line);
      color: #475569;
      font-size: 0.9rem;
    }
    .dots {
      display: flex;
      gap: 0.35rem;
    }
    .dot {
      width: 10px;
      height: 10px;
      border-radius: 999px;
      background: #cbd5e1;
    }
    .dot:nth-child(1) { background: #fb7185; }
    .dot:nth-child(2) { background: #fbbf24; }
    .dot:nth-child(3) { background: #34d399; }
    .pill {
      display: inline-flex;
      align-items: center;
      border: 1px solid rgba(6, 182, 212, 0.24);
      background: rgba(6, 182, 212, 0.08);
      color: #0f766e;
      border-radius: 999px;
      padding: 0.35rem 0.7rem;
      font-size: 0.75rem;
      font-weight: 700;
      letter-spacing: 0.04em;
      text-transform: uppercase;
    }
    .app-grid {
      display: grid;
      grid-template-columns: 0.68fr 1.32fr;
      min-height: 500px;
    }
    .app-sidebar {
      background: #f8fafc;
      border-right: 1px solid var(--line);
      padding: 1rem;
      display: grid;
      align-content: start;
      gap: 0.8rem;
    }
    .side-item {
      display: flex;
      align-items: center;
      gap: 0.65rem;
      padding: 0.75rem;
      border-radius: 1rem;
      color: #64748b;
      font-size: 0.88rem;
    }
    .side-item.active {
      color: #0f172a;
      background: #ffffff;
      box-shadow: 0 10px 26px rgba(15, 23, 42, 0.08);
    }
    .side-icon {
      width: 26px;
      height: 26px;
      display: grid;
      place-items: center;
      border-radius: 9px;
      background: #e0f2fe;
      color: #0369a1;
      font-size: 0.76rem;
      font-weight: 800;
    }
    .app-main {
      padding: 1.15rem;
      display: grid;
      gap: 1rem;
      background:
        linear-gradient(90deg, rgba(241, 245, 249, 0.65) 1px, transparent 1px),
        linear-gradient(180deg, rgba(241, 245, 249, 0.65) 1px, transparent 1px),
        #ffffff;
      background-size: 34px 34px;
    }
    .metric-row {
      display: grid;
      grid-template-columns: repeat(3, 1fr);
      gap: 0.8rem;
    }
    .metric {
      background: rgba(255, 255, 255, 0.9);
      border: 1px solid var(--line);
      border-radius: 1.1rem;
      padding: 0.9rem;
      box-shadow: 0 10px 24px rgba(15, 23, 42, 0.06);
    }
    .metric span {
      color: #64748b;
      font-size: 0.78rem;
    }
    .metric strong {
      display: block;
      color: #0f172a;
      font-size: 1.35rem;
      margin-top: 0.1rem;
    }
    .workflow-board {
      display: grid;
      grid-template-columns: 0.92fr 1.08fr;
      gap: 0.9rem;
    }
    .calendar-card,
    .draft-card,
    .approval-card,
    .channel-card {
      background: rgba(255, 255, 255, 0.94);
      border: 1px solid var(--line);
      border-radius: 1.25rem;
      padding: 1rem;
      box-shadow: 0 12px 30px rgba(15, 23, 42, 0.07);
    }
    .mini-title {
      display: flex;
      align-items: center;
      justify-content: space-between;
      margin-bottom: 0.85rem;
      color: #0f172a;
      font-weight: 800;
      font-size: 0.9rem;
    }
    .week-grid {
      display: grid;
      grid-template-columns: repeat(5, 1fr);
      gap: 0.45rem;
    }
    .day {
      min-height: 86px;
      border: 1px solid #e2e8f0;
      border-radius: 0.8rem;
      padding: 0.45rem;
      background: #f8fafc;
      color: #94a3b8;
      font-size: 0.72rem;
    }
    .post-chip {
      display: block;
      height: 22px;
      border-radius: 0.55rem;
      margin-top: 0.35rem;
      background: linear-gradient(135deg, #cffafe, #dbeafe);
    }
    .post-chip.alt { background: linear-gradient(135deg, #ccfbf1, #fef3c7); }
    .ai-draft {
      display: grid;
      gap: 0.55rem;
    }
    .draft-line {
      height: 10px;
      border-radius: 999px;
      background: #e2e8f0;
    }
    .draft-line:nth-child(2) { width: 82%; }
    .draft-line:nth-child(3) { width: 68%; }
    .draft-actions {
      display: flex;
      gap: 0.5rem;
      margin-top: 0.75rem;
    }
    .mini-button {
      border-radius: 999px;
      padding: 0.45rem 0.65rem;
      font-size: 0.72rem;
      font-weight: 700;
      background: #ecfeff;
      color: #0f766e;
      border: 1px solid rgba(6, 182, 212, 0.22);
    }
    .approval-card {
      grid-column: 1 / -1;
      display: grid;
      grid-template-columns: repeat(3, 1fr);
      gap: 0.7rem;
    }
    .approval-step {
      border-radius: 1rem;
      padding: 0.8rem;
      border: 1px solid #e2e8f0;
      background: #f8fafc;
      color: #475569;
      font-size: 0.82rem;
    }
    .approval-step strong {
      display: block;
      color: #0f172a;
      margin-bottom: 0.2rem;
    }
    .floating-card {
      position: absolute;
      background: rgba(255, 255, 255, 0.92);
      border: 1px solid rgba(15, 23, 42, 0.09);
      border-radius: 1.3rem;
      padding: 1rem;
      box-shadow: 0 24px 70px rgba(15, 23, 42, 0.16);
      backdrop-filter: blur(16px);
    }
    .floating-card.ai {
      right: -18px;
      top: 76px;
      max-width: 210px;
    }
    .floating-card.team {
      left: -26px;
      bottom: 68px;
      max-width: 235px;
    }
    .floating-card strong {
      display: block;
      color: #0f172a;
      font-size: 0.92rem;
      margin-bottom: 0.25rem;
    }
    .floating-card span {
      color: #64748b;
      font-size: 0.82rem;
    }
    .avatar-row {
      display: flex;
      margin-top: 0.75rem;
    }
    .avatar {
      width: 32px;
      height: 32px;
      border-radius: 999px;
      border: 2px solid #ffffff;
      margin-left: -8px;
      background: linear-gradient(135deg, #bae6fd, #99f6e4);
    }
    .avatar:first-child { margin-left: 0; }
    .section {
      position: relative;
      padding: 5rem 0;
    }
    .section-card {
      background: rgba(255, 255, 255, 0.78);
      border: 1px solid var(--line);
      border-radius: 2rem;
      padding: clamp(1.4rem, 4vw, 3rem);
      box-shadow: var(--soft-shadow);
      backdrop-filter: blur(18px);
    }
    .section-kicker {
      color: #0f766e;
      font-size: 0.8rem;
      font-weight: 800;
      letter-spacing: 0.14em;
      text-transform: uppercase;
      margin-bottom: 0.75rem;
    }
    .section h2 {
      font-size: clamp(1.85rem, 4vw, 3rem);
      line-height: 1.05;
      margin-bottom: 1rem;
      color: #0f172a;
      letter-spacing: -0.045em;
    }
    .section-lead {
      max-width: 780px;
      color: #64748b;
      font-size: 1.05rem;
    }
    .problem-grid {
      display: grid;
      grid-template-columns: 1.05fr 0.95fr;
      gap: 1.2rem;
      align-items: stretch;
      margin-top: 2rem;
    }
    .problem-list {
      display: grid;
      gap: 0.8rem;
    }
    .problem-item {
      display: flex;
      gap: 0.8rem;
      align-items: flex-start;
      background: #ffffff;
      border: 1px solid var(--line);
      border-radius: 1.25rem;
      padding: 1rem;
    }
    .problem-icon {
      width: 34px;
      height: 34px;
      flex: 0 0 auto;
      border-radius: 12px;
      display: grid;
      place-items: center;
      background: #fee2e2;
      color: #b91c1c;
      font-weight: 900;
    }
    .problem-item strong {
      display: block;
      color: #0f172a;
      margin-bottom: 0.15rem;
    }
    .problem-item span {
      color: #64748b;
      font-size: 0.92rem;
    }
    .before-after {
      display: grid;
      gap: 1rem;
    }
    .state-card {
      border-radius: 1.5rem;
      padding: 1.25rem;
      border: 1px solid var(--line);
      background: linear-gradient(135deg, #ffffff, #f8fafc);
    }
    .state-card.after {
      background: linear-gradient(135deg, #ecfeff, #eff6ff);
      border-color: rgba(6, 182, 212, 0.24);
    }
    .state-card strong {
      display: block;
      color: #0f172a;
      margin-bottom: 0.4rem;
    }
    .state-card p {
      color: #64748b;
      font-size: 0.95rem;
    }
    .steps-flow {
      display: grid;
      grid-template-columns: repeat(6, minmax(0, 1fr));
      gap: 0.8rem;
      margin-top: 2.25rem;
    }
    .step-card {
      position: relative;
      background: #ffffff;
      border: 1px solid var(--line);
      border-radius: 1.35rem;
      padding: 1rem;
      box-shadow: var(--soft-shadow);
      min-height: 164px;
    }
    .step-number {
      width: 34px;
      height: 34px;
      border-radius: 12px;
      display: grid;
      place-items: center;
      background: #ecfeff;
      color: #0f766e;
      font-weight: 900;
      margin-bottom: 0.8rem;
    }
    .step-card h3 {
      font-size: 0.98rem;
      color: #0f172a;
      margin-bottom: 0.35rem;
    }
    .step-card p {
      color: #64748b;
      font-size: 0.86rem;
    }
    .targets {
      display: grid;
      grid-template-columns: repeat(3, minmax(0, 1fr));
      gap: 1rem;
      margin-top: 2rem;
    }
    .target-card {
      background: #ffffff;
      border: 1px solid var(--line);
      border-radius: 1.4rem;
      padding: 1.25rem;
      box-shadow: var(--soft-shadow);
    }
    .target-icon {
      width: 42px;
      height: 42px;
      display: grid;
      place-items: center;
      border-radius: 16px;
      background: linear-gradient(135deg, #ecfeff, #dbeafe);
      color: #0f766e;
      font-weight: 900;
      margin-bottom: 1rem;
    }
    .target-card h3 {
      color: #0f172a;
      margin-bottom: 0.4rem;
    }
    .target-card p {
      color: #64748b;
      font-size: 0.93rem;
    }
    .features {
      display: grid;
      grid-template-columns: repeat(3, minmax(0, 1fr));
      gap: 1rem;
      margin-top: 2rem;
    }
    .feature {
      background: #ffffff;
      border: 1px solid var(--line);
      border-radius: 1.35rem;
      padding: 1.35rem;
      transition: all 0.3s ease;
      box-shadow: var(--soft-shadow);
    }
    .feature:hover {
      border-color: rgba(6, 182, 212, 0.34);
      transform: translateY(-4px);
    }
    .feature-icon {
      width: 44px;
      height: 44px;
      border-radius: 16px;
      display: grid;
      place-items: center;
      margin-bottom: 1rem;
      background: linear-gradient(135deg, #cffafe, #dbeafe);
      color: #0f3d4a;
      font-weight: 900;
    }
    .feature h3 {
      font-size: 1.05rem;
      margin-bottom: 0.75rem;
      color: #0f172a;
    }
    .feature p {
      color: #64748b;
      font-size: 0.95rem;
    }
    .platform-showcase {
      display: grid;
      grid-template-columns: 0.82fr 1.18fr;
      gap: 1.5rem;
      margin-top: 2rem;
      align-items: stretch;
    }
    .platform-copy {
      display: grid;
      gap: 1rem;
    }
    .module-card {
      background: #ffffff;
      border: 1px solid var(--line);
      border-radius: 1.3rem;
      padding: 1.15rem;
      box-shadow: var(--soft-shadow);
    }
    .module-card strong {
      display: block;
      color: #0f172a;
      margin-bottom: 0.3rem;
    }
    .module-card span {
      color: #64748b;
      font-size: 0.95rem;
    }
    .platform-app {
      background: #0f172a;
      color: #e2e8f0;
      border-radius: 2rem;
      padding: 1rem;
      box-shadow: 0 28px 90px rgba(15, 23, 42, 0.22);
      overflow: hidden;
    }
    .platform-top {
      display: flex;
      justify-content: space-between;
      align-items: center;
      border-bottom: 1px solid rgba(255, 255, 255, 0.1);
      padding: 0.45rem 0.45rem 1rem;
      color: #cbd5e1;
      font-size: 0.86rem;
    }
    .platform-body {
      display: grid;
      grid-template-columns: 1fr 1fr;
      gap: 0.8rem;
      padding-top: 1rem;
    }
    .dark-panel {
      background: rgba(255, 255, 255, 0.06);
      border: 1px solid rgba(255, 255, 255, 0.1);
      border-radius: 1.2rem;
      padding: 1rem;
    }
    .dark-panel h3 {
      color: #ffffff;
      font-size: 0.95rem;
      margin-bottom: 0.8rem;
    }
    .campaign-line {
      display: grid;
      gap: 0.5rem;
    }
    .channel-row {
      display: flex;
      align-items: center;
      justify-content: space-between;
      gap: 0.8rem;
      padding: 0.65rem;
      border-radius: 0.9rem;
      background: rgba(255, 255, 255, 0.07);
      color: #cbd5e1;
      font-size: 0.82rem;
    }
    .status-dot {
      width: 9px;
      height: 9px;
      border-radius: 999px;
      background: #22d3ee;
      box-shadow: 0 0 0 5px rgba(34, 211, 238, 0.12);
    }
    .content-preview {
      display: grid;
      gap: 0.6rem;
    }
    .preview-post {
      background: #ffffff;
      color: #0f172a;
      border-radius: 1rem;
      padding: 0.85rem;
    }
    .preview-post strong {
      display: block;
      margin-bottom: 0.35rem;
    }
    .preview-post p {
      color: #64748b;
      font-size: 0.82rem;
    }
    .status-grid {
      display: grid;
      grid-template-columns: repeat(3, minmax(0, 1fr));
      gap: 1rem;
      margin-top: 2rem;
    }
    .card {
      background: #ffffff;
      border: 1px solid var(--line);
      border-radius: 1.35rem;
      padding: 1.25rem;
      box-shadow: var(--soft-shadow);
    }
    .card h3 {
      color: #0f172a;
      margin-bottom: 0.5rem;
    }
    .card p, .card li {
      color: #64748b;
      font-size: 0.95rem;
    }
    .card ul {
      padding-left: 1.1rem;
      display: grid;
      gap: 0.45rem;
    }
    .status {
      border-top: 4px solid #06b6d4;
    }
    .status.warn {
      border-top-color: #f59e0b;
    }
    .status.limit {
      border-top-color: #64748b;
    }
    .trust-bar {
      display: grid;
      grid-template-columns: repeat(4, minmax(0, 1fr));
      gap: 1rem;
      margin-top: 2rem;
    }
    .trust-item {
      color: #64748b;
      border: 1px solid var(--line);
      border-radius: 1.2rem;
      padding: 1rem;
      background: rgba(255, 255, 255, 0.74);
    }
    .trust-item strong {
      display: block;
      color: #0f172a;
      margin-bottom: 0.25rem;
    }
    .cta-section {
      position: relative;
      overflow: hidden;
      text-align: center;
      padding: 4rem clamp(1.25rem, 5vw, 4rem);
      border: 1px solid rgba(6, 182, 212, 0.18);
      border-radius: 2rem;
      background:
        radial-gradient(circle at 16% 0%, rgba(34, 211, 238, 0.34), transparent 20rem),
        radial-gradient(circle at 85% 30%, rgba(37, 99, 235, 0.2), transparent 24rem),
        linear-gradient(135deg, #ffffff, #ecfeff);
      box-shadow: var(--shadow);
      margin: 2rem 0 5rem;
    }
    .cta-section::before {
      content: "";
      position: absolute;
      inset: auto -4rem -8rem auto;
      width: 280px;
      height: 280px;
      border-radius: 999px;
      background: rgba(6, 182, 212, 0.16);
    }
    .cta-button {
      display: inline-block;
      background: linear-gradient(135deg, #0f766e, #06b6d4);
      color: #ffffff;
      padding: 1rem 2rem;
      border-radius: 999px;
      text-decoration: none;
      font-weight: 800;
      font-size: 1rem;
      transition: all 0.3s ease;
      margin: 0.35rem;
      box-shadow: 0 16px 34px rgba(6, 182, 212, 0.24);
    }
    .cta-button:hover {
      transform: translateY(-2px);
      box-shadow: 0 20px 42px rgba(6, 182, 212, 0.32);
    }
    .cta-button.secondary {
      background: #ffffff;
      color: #0f3d4a;
      border: 1px solid rgba(6, 182, 212, 0.24);
      box-shadow: none;
    }
    .cta-button.secondary:hover {
      background: #ecfeff;
    }
    .note {
      max-width: 760px;
      margin: 1.25rem auto 0;
      color: #64748b;
      font-size: 0.95rem;
    }
    footer {
      text-align: center;
      padding: 2rem;
      color: #64748b;
      font-size: 0.875rem;
      border-top: 1px solid var(--line);
    }
    footer a {
      color: #0f766e;
      text-decoration: none;
    }
    footer a:hover {
      text-decoration: underline;
    }
    @media (max-width: 1040px) {
      .hero-grid,
      .problem-grid,
      .platform-showcase {
        grid-template-columns: 1fr;
      }
      .product-visual { min-height: auto; }
      .dashboard-mockup { transform: none; }
      .floating-card { position: static; margin-top: 1rem; max-width: none; }
      .steps-flow { grid-template-columns: repeat(3, minmax(0, 1fr)); }
      .features,
      .targets,
      .status-grid,
      .trust-bar { grid-template-columns: repeat(2, minmax(0, 1fr)); }
    }
    @media (max-width: 768px) {
      .container { width: min(100% - 24px, 1180px); }
      .nav { align-items: flex-start; flex-direction: column; }
      .nav-links { width: 100%; }
      header { padding: 4rem 0 2.5rem; }
      h1 { font-size: 3rem; }
      .subtitle { font-size: 1.125rem; }
      .hero-proof,
      .metric-row,
      .workflow-board,
      .approval-card,
      .steps-flow,
      .features,
      .targets,
      .status-grid,
      .trust-bar,
      .platform-body { grid-template-columns: 1fr; }
      .app-grid { grid-template-columns: 1fr; }
      .app-sidebar { display: none; }
      .week-grid { grid-template-columns: repeat(2, 1fr); }
    }
  </style>
</head>
<body>
  <div class="container">
    <nav class="nav">
      <div class="brand"><span class="brand-mark" aria-hidden="true"></span>SocialFlow</div>
      <div class="nav-links">
        <a href="#problema">Qué resuelve</a>
        <a href="#como-funciona">Cómo funciona</a>
        <a href="#plataforma">Plataforma</a>
        <a href="#capacidades">Capacidades</a>
        <a href="#piloto">Piloto</a>
        <a href="https://drako.systems/contact">Contacto</a>
      </div>
    </nav>

    <header>
      <div class="hero-grid">
        <div>
          <div class="logo">SocialFlow · Plataforma SaaS piloto</div>
          <h1>Automatización social asistida por IA para <span class="accent-text">equipos que publican en serio.</span></h1>
          <p class="subtitle">Planifica, prepara, organiza y coordina contenido social multicanal con IA conectada al trabajo real y revisión humana antes de publicar.</p>
          <p class="description">SocialFlow convierte ideas, campañas y activos de marca en un sistema operativo social: canales claros, calendario editorial, borradores asistidos, coordinación de equipo y trazabilidad operativa.</p>
          <p class="description">Diseñado para empresas, marcas, agencias pequeñas, equipos de marketing y emprendedores que necesitan consistencia sin depender de improvisar cada publicación.</p>
          <span class="pilot-badge">Piloto controlado · acceso por invitación</span>
          <div class="hero-actions">
            <a href="https://drako.systems/contact" class="cta-button">Solicitar piloto</a>
            <a href="#plataforma" class="cta-button secondary">Ver la plataforma</a>
          </div>
          <div class="hero-proof" aria-label="Resumen de valor">
            <div class="proof-card"><strong>Plan editorial</strong><span>Semanas de contenido con estructura</span></div>
            <div class="proof-card"><strong>IA + revisión</strong><span>Borradores útiles, control humano</span></div>
            <div class="proof-card"><strong>Multicanal</strong><span>Campañas, marcas y redes ordenadas</span></div>
          </div>
        </div>
        <aside class="product-visual" aria-label="Mockup visual de plataforma SocialFlow">
          <div class="visual-glow"></div>
          <div class="dashboard-mockup">
            <div class="browser-bar">
              <div class="dots"><span class="dot"></span><span class="dot"></span><span class="dot"></span></div>
              <strong>SocialFlow Workspace</strong>
              <span class="pill">Control humano</span>
            </div>
            <div class="app-grid">
              <div class="app-sidebar">
                <div class="side-item active"><span class="side-icon">AI</span>Asistente editorial</div>
                <div class="side-item"><span class="side-icon">CL</span>Canales</div>
                <div class="side-item"><span class="side-icon">CA</span>Calendario</div>
                <div class="side-item"><span class="side-icon">RV</span>Revisión</div>
                <div class="side-item"><span class="side-icon">OP</span>Operación</div>
              </div>
              <div class="app-main">
                <div class="metric-row">
                  <div class="metric"><span>Campañas activas</span><strong>4</strong></div>
                  <div class="metric"><span>Borradores listos</span><strong>18</strong></div>
                  <div class="metric"><span>Pendientes de revisión</span><strong>6</strong></div>
                </div>
                <div class="workflow-board">
                  <div class="calendar-card">
                    <div class="mini-title"><span>Calendario editorial</span><span>Semana</span></div>
                    <div class="week-grid">
                      <div class="day">Lun<span class="post-chip"></span></div>
                      <div class="day">Mar<span class="post-chip alt"></span></div>
                      <div class="day">Mié<span class="post-chip"></span></div>
                      <div class="day">Jue<span class="post-chip alt"></span></div>
                      <div class="day">Vie<span class="post-chip"></span></div>
                    </div>
                  </div>
                  <div class="draft-card">
                    <div class="mini-title"><span>Borrador asistido por IA</span><span>Draft</span></div>
                    <div class="ai-draft">
                      <div class="draft-line"></div>
                      <div class="draft-line"></div>
                      <div class="draft-line"></div>
                      <div class="draft-actions">
                        <span class="mini-button">Editar tono</span>
                        <span class="mini-button">Enviar a revisión</span>
                      </div>
                    </div>
                  </div>
                  <div class="approval-card">
                    <div class="approval-step"><strong>Idea</strong>Brief y campaña</div>
                    <div class="approval-step"><strong>IA</strong>Estructura y variantes</div>
                    <div class="approval-step"><strong>Equipo</strong>Revisión antes de publicar</div>
                  </div>
                </div>
              </div>
            </div>
          </div>
          <div class="floating-card ai">
            <strong>IA conectada al workflow</strong>
            <span>Propone estructura, versiones y próximos pasos sin saltarse la revisión.</span>
          </div>
          <div class="floating-card team">
            <strong>Equipo coordinado</strong>
            <span>Marketing, founders y clientes trabajan sobre un mismo plan.</span>
            <div class="avatar-row"><span class="avatar"></span><span class="avatar"></span><span class="avatar"></span></div>
          </div>
        </aside>
      </div>
    </header>

    <section id="problema" class="section">
      <div class="section-card">
        <p class="section-kicker">Qué resuelve</p>
        <h2>El problema no es tener ideas. Es convertirlas en una operación social constante.</h2>
        <p class="section-lead">Muchas empresas publican a golpes de urgencia: contenido disperso, calendarios invisibles, redes abandonadas y demasiada dependencia de la inspiración del día.</p>
        <div class="problem-grid">
          <div class="problem-list">
            <div class="problem-item"><span class="problem-icon">!</span><div><strong>Caos editorial</strong><span>Ideas, campañas y mensajes viven en chats, documentos y notas sin prioridad clara.</span></div></div>
            <div class="problem-item"><span class="problem-icon">!</span><div><strong>Inconsistencia</strong><span>La marca aparece una semana y desaparece la siguiente porque no hay sistema.</span></div></div>
            <div class="problem-item"><span class="problem-icon">!</span><div><strong>Improvisación constante</strong><span>Cada publicación empieza desde cero y consume energía estratégica.</span></div></div>
            <div class="problem-item"><span class="problem-icon">!</span><div><strong>Operación dispersa</strong><span>Marketing, dirección, founders y clientes no comparten una vista operativa común.</span></div></div>
          </div>
          <div class="before-after">
            <div class="state-card">
              <strong>Antes</strong>
              <p>Publicaciones sueltas, calendario incompleto, decisiones urgentes y poca trazabilidad sobre qué se preparó, revisó o quedó pendiente.</p>
            </div>
            <div class="state-card after">
              <strong>Con SocialFlow</strong>
              <p>Canales definidos, campañas ordenadas, borradores asistidos por IA y un flujo claro para revisar antes de distribuir contenido.</p>
            </div>
          </div>
        </div>
      </div>
    </section>

    <section id="como-funciona" class="section">
      <p class="section-kicker">Cómo funciona</p>
      <h2>De la idea dispersa al calendario revisable.</h2>
      <p class="section-lead">SocialFlow acompaña el ciclo operativo completo: ordenar canales, definir línea editorial, preparar calendario, generar borradores asistidos, revisar y coordinar distribución con control humano.</p>
      <div class="steps-flow">
        <div class="step-card"><div class="step-number">1</div><h3>Organizas canales</h3><p>Separas líneas de negocio, marcas, audiencias o campañas.</p></div>
        <div class="step-card"><div class="step-number">2</div><h3>Defines estrategia</h3><p>Clarificas tono, temas recurrentes y objetivos por canal.</p></div>
        <div class="step-card"><div class="step-number">3</div><h3>Preparas calendario</h3><p>Construyes una vista semanal o mensual con prioridades reales.</p></div>
        <div class="step-card"><div class="step-number">4</div><h3>Generas borradores</h3><p>La IA propone estructuras, posts y variantes editables.</p></div>
        <div class="step-card"><div class="step-number">5</div><h3>Revisas</h3><p>El equipo valida tono, precisión y oportunidad antes de publicar.</p></div>
        <div class="step-card"><div class="step-number">6</div><h3>Distribuyes</h3><p>Coordinas presencia digital sin perder control editorial.</p></div>
      </div>
    </section>

    <section id="para-quien" class="section">
      <p class="section-kicker">Para quién es</p>
      <h2>Para empresas, marcas y emprendedores que quieren operar contenido como sistema.</h2>
      <p class="section-lead">SocialFlow está diseñado para equipos que necesitan una plataforma operativa, no otro documento suelto con ideas.</p>
      <div class="targets">
        <div class="target-card"><div class="target-icon">B2B</div><h3>Empresas</h3><p>Autoridad de marca, contenido educativo, campañas y presencia profesional constante.</p></div>
        <div class="target-card"><div class="target-icon">MK</div><h3>Equipos de marketing</h3><p>Plan editorial, revisión interna y coordinación entre mensajes, campañas y canales.</p></div>
        <div class="target-card"><div class="target-icon">AG</div><h3>Agencias pequeñas</h3><p>Operación multicliente con estructuras reutilizables y entregables más claros.</p></div>
        <div class="target-card"><div class="target-icon">EM</div><h3>Emprendedores</h3><p>Una forma práctica de sostener presencia digital sin vivir improvisando publicaciones.</p></div>
        <div class="target-card"><div class="target-icon">BR</div><h3>Marcas</h3><p>Campañas, lanzamientos, líneas editoriales y series de contenido con consistencia.</p></div>
        <div class="target-card"><div class="target-icon">LC</div><h3>Negocios locales</h3><p>Promociones, novedades, agenda comercial y contenido útil para comunidad cercana.</p></div>
      </div>
    </section>

    <section id="plataforma" class="section">
      <div class="section-card">
        <p class="section-kicker">Bloque visual plataforma</p>
        <h2>Una plataforma operativa para planificar, preparar y coordinar contenido social.</h2>
        <p class="section-lead">La experiencia pública muestra la dirección del producto: un workspace SaaS donde IA, calendario, canales y revisión humana conviven en una misma operación.</p>
        <div class="platform-showcase">
          <div class="platform-copy">
            <div class="module-card"><strong>Workspace editorial</strong><span>Vista central para campañas, canales temáticos, estado de piezas y próximos pasos.</span></div>
            <div class="module-card"><strong>Asistente IA aplicado</strong><span>Ayuda a estructurar ideas, generar borradores y preparar variantes sin reemplazar criterio humano.</span></div>
            <div class="module-card"><strong>Control operativo</strong><span>Estados, revisión, trazabilidad y coordinación para que el contenido llegue listo, no improvisado.</span></div>
          </div>
          <div class="platform-app" aria-label="Mockup de aplicación SocialFlow">
            <div class="platform-top">
              <strong>SocialFlow Control Room</strong>
              <span>Campaña: Lanzamiento Q2</span>
            </div>
            <div class="platform-body">
              <div class="dark-panel">
                <h3>Canales activos</h3>
                <div class="campaign-line">
                  <div class="channel-row"><span>LinkedIn y redes sociales</span><span class="status-dot"></span></div>
                  <div class="channel-row"><span>Marca personal founder</span><span class="status-dot"></span></div>
                  <div class="channel-row"><span>Contenido educativo</span><span class="status-dot"></span></div>
                  <div class="channel-row"><span>Campaña comercial</span><span class="status-dot"></span></div>
                </div>
              </div>
              <div class="dark-panel">
                <h3>Borradores asistidos</h3>
                <div class="content-preview">
                  <div class="preview-post"><strong>Post de autoridad</strong><p>Idea central, ángulo editorial, CTA y versión corta para revisión.</p></div>
                  <div class="preview-post"><strong>Serie semanal</strong><p>Tres piezas conectadas para mantener presencia sin improvisar.</p></div>
                </div>
              </div>
              <div class="dark-panel">
                <h3>Revisión humana</h3>
                <div class="campaign-line">
                  <div class="channel-row"><span>Tono de marca</span><span>Aprobado</span></div>
                  <div class="channel-row"><span>Mensaje comercial</span><span>En revisión</span></div>
                  <div class="channel-row"><span>Calendario</span><span>Listo</span></div>
                </div>
              </div>
              <div class="dark-panel">
                <h3>Operación trazable</h3>
                <div class="content-preview">
                  <div class="preview-post"><strong>Próximo paso</strong><p>Revisar variantes, elegir fecha y coordinar distribución del contenido.</p></div>
                </div>
              </div>
            </div>
          </div>
        </div>
      </div>
    </section>

    <section id="capacidades" class="section">
      <p class="section-kicker">Qué automatiza</p>
      <h2>Capacidades de plataforma para una operación social más clara.</h2>
      <p class="section-lead">SocialFlow automatiza apoyo operativo: estructura, preparación, organización y coordinación. La aprobación final sigue siendo humana.</p>
      <div class="features">
        <div class="feature">
          <div class="feature-icon">01</div>
          <h3>Canales temáticos</h3>
          <p>Organiza tu contenido por temas, marcas o proyectos. Cada canal con su propia identidad y calendario.</p>
        </div>
        <div class="feature">
          <div class="feature-icon">02</div>
          <h3>Calendario y programación</h3>
          <p>Prepara semanas completas de contenido y alinea ideas, fechas clave y campañas.</p>
        </div>
        <div class="feature">
          <div class="feature-icon">03</div>
          <h3>Borradores asistidos por IA</h3>
          <p>Convierte briefs, ideas y campañas en propuestas editables para revisar con el equipo.</p>
        </div>
        <div class="feature">
          <div class="feature-icon">04</div>
          <h3>Organización multicanal</h3>
          <p>Coordina mensajes por audiencia, canal, objetivo y momento sin duplicar trabajo.</p>
        </div>
        <div class="feature">
          <div class="feature-icon">05</div>
          <h3>LinkedIn y redes sociales</h3>
          <p>Prioriza flujos profesionales y distribución social con revisión humana antes de publicar.</p>
        </div>
        <div class="feature">
          <div class="feature-icon">06</div>
          <h3>Operación trazable</h3>
          <p>Mantén visibilidad sobre qué está en idea, borrador, revisión, listo o pendiente.</p>
        </div>
        <div class="feature">
          <div class="feature-icon">07</div>
          <h3>Revisión humana</h3>
          <p>Control editorial antes de distribuir para evitar automatización ciega o mensajes fuera de tono.</p>
        </div>
        <div class="feature">
          <div class="feature-icon">08</div>
          <h3>Operación asistida por IA</h3>
          <p>Genera estructura, variantes, borradores y tareas para reducir trabajo repetitivo.</p>
        </div>
        <div class="feature">
          <div class="feature-icon">09</div>
          <h3>Campañas y series</h3>
          <p>Planifica secuencias de contenido con intención comercial, educativa o de comunidad.</p>
        </div>
      </div>
    </section>

    <section id="piloto" class="section">
      <p class="section-kicker">Estado real del producto</p>
      <h2>Piloto controlado, no venta masiva.</h2>
      <p class="section-lead">SocialFlow se presenta como plataforma SaaS piloto seria, pero todavía bajo acceso controlado para validar workflows, calidad editorial y seguridad operativa con clientes reales.</p>
      <div class="status-grid">
        <div class="card status">
          <h3>Disponible ahora</h3>
          <ul>
            <li>Diagnóstico de operación social.</li>
            <li>Diseño de canales temáticos.</li>
            <li>Plan editorial inicial.</li>
            <li>Preparación asistida de borradores.</li>
          </ul>
        </div>
        <div class="card status warn">
          <h3>En validación</h3>
          <ul>
            <li>Automatizaciones avanzadas por cliente.</li>
            <li>Flujos de aprobación y distribución completa.</li>
            <li>Onboarding self-serve y panel cliente definitivo.</li>
          </ul>
        </div>
        <div class="card status limit">
          <h3>No prometemos todavía</h3>
          <ul>
            <li>Publicación automática sin revisión.</li>
            <li>Integraciones no verificadas como producción.</li>
            <li>Resultados virales garantizados.</li>
          </ul>
        </div>
      </div>
      <div class="trust-bar">
        <div class="trust-item"><strong>Cloudflare-first</strong> Worker aislado en dominio canónico.</div>
        <div class="trust-item"><strong>Sin trackers</strong> HTML público sin cookies ni JS externo.</div>
        <div class="trust-item"><strong>APIs protegidas</strong> Rutas internas siguen cerradas sin Origin válido.</div>
        <div class="trust-item"><strong>Fase controlada</strong> Pilotos con alcance definido y revisión humana.</div>
      </div>
    </section>

    <section class="cta-section" aria-label="Solicitar piloto SocialFlow">
      <p class="section-kicker">CTA final</p>
      <h2>Convierte tu operación social en un sistema claro, visual y asistido por IA.</h2>
      <p class="section-lead" style="margin: 0 auto 1.5rem;">Si tu equipo necesita publicar con más consistencia, SocialFlow puede ayudarte a ordenar canales, calendario, borradores y revisión en un piloto con alcance claro.</p>
      <a href="https://drako.systems/contact" class="cta-button">Solicitar piloto</a>
      <a href="https://drako.systems/contact" class="cta-button secondary">Hablar con Drako</a>
      <a href="#piloto" class="cta-button secondary">Acceso cliente: próximamente</a>
      <p class="note">El acceso cliente completo todavía no está abierto. Si ya formas parte de un piloto, el equipo Drako te indicará el canal seguro de entrada.</p>
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
