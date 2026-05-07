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
  <meta name="description" content="SocialFlow es un SaaS piloto de automatización social asistida por IA para planificar, organizar y preparar publicaciones para canales de contenido.">
  <title>SocialFlow - Operación social asistida por IA</title>
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
    a { color: inherit; }
    .container {
      max-width: 1200px;
      margin: 0 auto;
      padding: 2rem;
      flex: 1;
    }
    .nav {
      display: flex;
      align-items: center;
      justify-content: space-between;
      gap: 1rem;
      padding: 1rem 0 2rem;
      color: #cbd5e1;
    }
    .brand {
      font-size: 0.95rem;
      font-weight: 700;
      letter-spacing: 0.08em;
      text-transform: uppercase;
      color: #f8fafc;
    }
    .nav-links {
      display: flex;
      flex-wrap: wrap;
      gap: 1rem;
      font-size: 0.9rem;
      color: #94a3b8;
    }
    .nav-links a {
      text-decoration: none;
    }
    .nav-links a:hover {
      color: #22d3ee;
    }
    header {
      position: relative;
      overflow: hidden;
      text-align: left;
      padding: 4rem 0;
      border-bottom: 1px solid rgba(241, 245, 249, 0.1);
    }
    .hero-grid {
      display: grid;
      grid-template-columns: minmax(0, 1.15fr) minmax(320px, 0.85fr);
      gap: 3rem;
      align-items: center;
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
      font-size: clamp(2.4rem, 6vw, 5.25rem);
      line-height: 0.95;
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
      max-width: 680px;
    }
    .description {
      font-size: 1.125rem;
      color: #cbd5e1;
      max-width: 720px;
      margin: 0 0 1rem;
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
    .hero-actions {
      display: flex;
      flex-wrap: wrap;
      gap: 0.85rem;
      margin-top: 2rem;
    }
    .panel {
      background: linear-gradient(180deg, rgba(15, 23, 42, 0.88), rgba(30, 41, 59, 0.88));
      border: 1px solid rgba(148, 163, 184, 0.18);
      border-radius: 1.5rem;
      padding: 1.25rem;
      box-shadow: 0 30px 80px rgba(2, 6, 23, 0.45);
    }
    .panel-header {
      display: flex;
      justify-content: space-between;
      gap: 1rem;
      padding-bottom: 1rem;
      border-bottom: 1px solid rgba(148, 163, 184, 0.16);
      color: #cbd5e1;
      font-size: 0.9rem;
    }
    .pill {
      display: inline-flex;
      align-items: center;
      border: 1px solid rgba(34, 211, 238, 0.24);
      background: rgba(34, 211, 238, 0.08);
      color: #67e8f9;
      border-radius: 999px;
      padding: 0.35rem 0.7rem;
      font-size: 0.75rem;
      font-weight: 700;
      letter-spacing: 0.04em;
      text-transform: uppercase;
    }
    .timeline {
      display: grid;
      gap: 0.85rem;
      margin-top: 1rem;
    }
    .timeline-item {
      border: 1px solid rgba(148, 163, 184, 0.14);
      border-radius: 1rem;
      padding: 1rem;
      background: rgba(15, 23, 42, 0.7);
    }
    .timeline-item strong {
      display: block;
      margin-bottom: 0.35rem;
      color: #f8fafc;
    }
    .timeline-item span {
      color: #94a3b8;
      font-size: 0.9rem;
    }
    .section {
      padding: 4rem 0;
      border-bottom: 1px solid rgba(241, 245, 249, 0.08);
    }
    .section-kicker {
      color: #22d3ee;
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
      color: #f8fafc;
    }
    .section-lead {
      max-width: 780px;
      color: #94a3b8;
      font-size: 1.05rem;
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
    .use-cases, .status-grid, .steps {
      display: grid;
      grid-template-columns: repeat(auto-fit, minmax(240px, 1fr));
      gap: 1rem;
      margin-top: 2rem;
    }
    .card {
      background: rgba(15, 23, 42, 0.58);
      border: 1px solid rgba(148, 163, 184, 0.14);
      border-radius: 1rem;
      padding: 1.25rem;
    }
    .card h3 {
      color: #f8fafc;
      margin-bottom: 0.5rem;
    }
    .card p, .card li {
      color: #94a3b8;
      font-size: 0.95rem;
    }
    .card ul {
      padding-left: 1.1rem;
      display: grid;
      gap: 0.45rem;
    }
    .status {
      border-left: 3px solid #22d3ee;
    }
    .status.warn {
      border-left-color: #f59e0b;
    }
    .trust-bar {
      display: grid;
      grid-template-columns: repeat(auto-fit, minmax(180px, 1fr));
      gap: 1rem;
      margin-top: 2rem;
    }
    .trust-item {
      color: #cbd5e1;
      border: 1px solid rgba(148, 163, 184, 0.14);
      border-radius: 1rem;
      padding: 1rem;
      background: rgba(241, 245, 249, 0.04);
    }
    .trust-item strong {
      display: block;
      color: #f8fafc;
      margin-bottom: 0.25rem;
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
    .note {
      max-width: 760px;
      margin: 1.25rem auto 0;
      color: #94a3b8;
      font-size: 0.95rem;
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
      .container { padding: 1.25rem; }
      .nav { align-items: flex-start; flex-direction: column; }
      .hero-grid { grid-template-columns: 1fr; }
      h1 { font-size: 2.4rem; }
      .subtitle { font-size: 1.125rem; }
      .features { grid-template-columns: 1fr; }
    }
  </style>
</head>
<body>
  <div class="container">
    <nav class="nav">
      <div class="brand">SocialFlow</div>
      <div class="nav-links">
        <a href="#para-quien">Para quién</a>
        <a href="#capacidades">Capacidades</a>
        <a href="#piloto">Piloto</a>
        <a href="https://drako.systems/contact">Contacto</a>
      </div>
    </nav>

    <header>
      <div class="hero-grid">
        <div>
          <div class="logo">SocialFlow · SaaS piloto</div>
          <h1>Automatización social asistida por IA para canales de contenido.</h1>
          <p class="subtitle">Planifica, organiza y prepara publicaciones para marcas, negocios y proyectos con múltiples canales temáticos.</p>
          <p class="description">SocialFlow ayuda a convertir ideas, campañas y activos de marca en una operación social más clara: canales definidos, calendario editorial, piezas preparadas y revisión humana antes de publicar.</p>
          <p class="description">Actualmente en fase piloto controlada dentro del ecosistema Drako.</p>
          <span class="pilot-badge">Piloto controlado · acceso por invitación</span>
          <div class="hero-actions">
            <a href="https://drako.systems/contact" class="cta-button">Solicitar piloto</a>
            <a href="#piloto" class="cta-button secondary">Ver alcance del piloto</a>
          </div>
        </div>
        <aside class="panel" aria-label="Resumen operativo de SocialFlow">
          <div class="panel-header">
            <strong>Operación social</strong>
            <span class="pill">Control humano</span>
          </div>
          <div class="timeline">
            <div class="timeline-item">
              <strong>1. Ordena canales temáticos</strong>
              <span>Separa marcas, líneas de negocio, campañas o audiencias.</span>
            </div>
            <div class="timeline-item">
              <strong>2. Prepara calendario editorial</strong>
              <span>Convierte ideas en un plan semanal o mensual revisable.</span>
            </div>
            <div class="timeline-item">
              <strong>3. Genera borradores asistidos</strong>
              <span>Trabaja con propuestas listas para editar, aprobar y publicar.</span>
            </div>
            <div class="timeline-item">
              <strong>4. Mantiene trazabilidad</strong>
              <span>Prioriza consistencia, seguridad y revisión antes de automatizar.</span>
            </div>
          </div>
        </aside>
      </div>
    </header>

    <section id="para-quien" class="section">
      <p class="section-kicker">Para quién es</p>
      <h2>Para equipos que necesitan publicar con ritmo sin improvisar cada semana.</h2>
      <p class="section-lead">SocialFlow está pensado para negocios, marcas personales, agencias pequeñas y proyectos con varias líneas de contenido que necesitan transformar ideas dispersas en una operación editorial consistente.</p>
      <div class="use-cases">
        <div class="card">
          <h3>Negocios B2B</h3>
          <p>Contenido educativo, autoridad de marca, casos de cliente y presencia constante en canales profesionales.</p>
        </div>
        <div class="card">
          <h3>Marcas y creadores</h3>
          <p>Calendarios temáticos, series de contenido, lanzamientos y mensajes coherentes entre campañas.</p>
        </div>
        <div class="card">
          <h3>Equipos operativos</h3>
          <p>Preparación de borradores, revisión interna y coordinación antes de publicar en redes.</p>
        </div>
      </div>
    </section>

    <section id="capacidades" class="section">
      <p class="section-kicker">Qué automatiza</p>
      <h2>Menos caos editorial. Más sistema operativo para contenido social.</h2>
      <p class="section-lead">El objetivo del piloto no es prometer publicación automática sin control, sino validar un flujo seguro de planificación, preparación y operación asistida.</p>
      <div class="features">
        <div class="feature">
          <h3>Canales temáticos</h3>
          <p>Organiza tu contenido por temas, marcas o proyectos. Cada canal con su propia identidad y calendario.</p>
        </div>
        <div class="feature">
          <h3>Calendario y programación</h3>
          <p>Prepara semanas completas de contenido y alinea ideas, fechas clave y campañas.</p>
        </div>
        <div class="feature">
          <h3>LinkedIn y redes sociales</h3>
          <p>Prioriza flujos profesionales y distribución social con revisión humana antes de publicar.</p>
        </div>
        <div class="feature">
          <h3>Operación asistida por IA</h3>
          <p>Genera estructura, variantes, borradores y tareas para reducir trabajo repetitivo.</p>
        </div>
      </div>
    </section>

    <section id="piloto" class="section">
      <p class="section-kicker">Estado real del producto</p>
      <h2>Piloto controlado, no venta masiva.</h2>
      <p class="section-lead">SocialFlow se presenta como una primera versión comercial seria, pero todavía bajo acceso controlado para validar workflows, calidad editorial y seguridad operativa con clientes reales.</p>
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
            <li>Flujos de aprobación y publicación completa.</li>
            <li>Onboarding self-serve y panel cliente definitivo.</li>
          </ul>
        </div>
        <div class="card status">
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

    <section class="section">
      <p class="section-kicker">Cómo empezar</p>
      <h2>Un piloto simple, con alcance claro.</h2>
      <div class="steps">
        <div class="card">
          <h3>1. Solicitud</h3>
          <p>Cuéntanos qué canales gestionas, frecuencia deseada y principal bloqueo operativo.</p>
        </div>
        <div class="card">
          <h3>2. Diseño</h3>
          <p>Definimos canales, tono, calendario inicial y criterios de revisión.</p>
        </div>
        <div class="card">
          <h3>3. Operación piloto</h3>
          <p>Preparamos contenido y medimos si el sistema reduce carga sin perder control.</p>
        </div>
      </div>
    </section>

    <section class="cta-section" aria-label="Solicitar piloto SocialFlow">
      <h2 style="margin-bottom: 1.5rem; font-size: 1.875rem;">Convierte tu operación social en un sistema claro.</h2>
      <a href="https://drako.systems/contact" class="cta-button">Solicitar piloto</a>
      <a href="#" class="cta-button secondary">Acceso cliente: próximamente</a>
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
