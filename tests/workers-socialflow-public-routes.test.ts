import { describe, expect, it } from "vitest";
import { createWorkersHandlers } from "../packages/shared/workers-handlers";

function buildRequest(pathname: string, method: string, includeOrigin: boolean, hostName = "socialflow.drako.systems"): Request {
  const headers: Record<string, string> = {
    host: hostName,
  };
  if (includeOrigin) {
    headers.origin = `https://${hostName}`;
  }
  return new Request(`https://${hostName}${pathname}`, {
    method,
    headers,
  });
}

async function readResponse(response: Response): Promise<{ text: string; json?: Record<string, unknown> }> {
  const text = await response.text();
  let json: Record<string, unknown> | undefined;
  try {
    json = JSON.parse(text) as Record<string, unknown>;
  } catch {
    // Not JSON, that's fine
  }
  return { text, json };
}

describe("socialflow public routes", () => {
  const handler = createWorkersHandlers({
    saasSlug: "socialflows",
    workerName: "saas-socialflows-prod",
    domainName: "socialflows.drako.systems",
    aliasDomainNames: ["socialflow.drako.systems"],
    authsSecretName: "SOCIALFLOWS_AUTHS_SECRET",
    allSaasesSlugs: ["socialflows"],
  });

  const env = { SAASES_DOMAIN: "socialflows.drako.systems,socialflow.drako.systems" };

  describe("public routes without Origin header", () => {
    it("GET / returns 200 HTML without Origin header", async () => {
      const response = await handler.handleRequest(buildRequest("/", "GET", false), env);
      const { text } = await readResponse(response);

      expect(response.status).toBe(200);
      expect(response.headers.get("content-type")).toContain("text/html");
      expect(text).toContain("SocialFlow");
      expect(text).toContain("Convierte tu operación social en un sistema asistido por IA.");
    });

    it("GET /socialflow returns 200 HTML without Origin header", async () => {
      const response = await handler.handleRequest(buildRequest("/socialflow", "GET", false), env);
      const { text } = await readResponse(response);

      expect(response.status).toBe(200);
      expect(response.headers.get("content-type")).toContain("text/html");
      expect(text).toContain("SocialFlow");
    });

    it("GET /socialflow/auth returns 200 HTML without Origin header", async () => {
      const response = await handler.handleRequest(buildRequest("/socialflow/auth", "GET", false), env);
      const { text } = await readResponse(response);

      expect(response.status).toBe(200);
      expect(response.headers.get("content-type")).toContain("text/html");
      expect(text).toContain("SocialFlow");
      expect(text).toContain("próximamente");
    });
  });

  describe("public routes work on both canonical and compat domains", () => {
    it("GET / works on canonical domain socialflow.drako.systems", async () => {
      const response = await handler.handleRequest(buildRequest("/", "GET", false, "socialflow.drako.systems"), env);
      expect(response.status).toBe(200);
      expect(response.headers.get("content-type")).toContain("text/html");
    });

    it("GET / works on compat domain socialflows.drako.systems", async () => {
      const response = await handler.handleRequest(buildRequest("/", "GET", false, "socialflows.drako.systems"), env);
      expect(response.status).toBe(200);
      expect(response.headers.get("content-type")).toContain("text/html");
    });
  });

  describe("API routes still require Origin header", () => {
    it("GET /api/socialflow/profile without Origin returns 403", async () => {
      const response = await handler.handleRequest(buildRequest("/api/socialflow/profile", "GET", false), env);
      const { json } = await readResponse(response);

      expect(response.status).toBe(403);
      expect(json?.error).toBe("Unauthorized origin");
    });

    it("POST /api/socialflow/posts without Origin returns 403", async () => {
      const response = await handler.handleRequest(buildRequest("/api/socialflow/posts", "POST", false), env);
      const { json } = await readResponse(response);

      expect(response.status).toBe(403);
      expect(json?.error).toBe("Unauthorized origin");
    });

    it("GET /api/* without Origin remains protected", async () => {
      const response = await handler.handleRequest(buildRequest("/api/health", "GET", false), env);
      const { json } = await readResponse(response);

      expect(response.status).toBe(403);
      expect(json?.error).toBe("Unauthorized origin");
    });
  });

  describe("non-public routes still require Origin header", () => {
    it("GET /operator/socialflow without Origin returns 403", async () => {
      const response = await handler.handleRequest(buildRequest("/operator/socialflow", "GET", false), env);
      const { json } = await readResponse(response);

      expect(response.status).toBe(403);
      expect(json?.error).toBe("Unauthorized origin");
    });

    it("GET /socialflow/workspace without Origin returns 403", async () => {
      const response = await handler.handleRequest(buildRequest("/socialflow/workspace", "GET", false), env);
      const { json } = await readResponse(response);

      expect(response.status).toBe(403);
      expect(json?.error).toBe("Unauthorized origin");
    });
  });

  describe("POST to public routes returns 400 for invalid body", () => {
    it("POST / returns 400 for missing JSON body", async () => {
      const response = await handler.handleRequest(buildRequest("/", "POST", true), env);
      const { json } = await readResponse(response);

      expect(response.status).toBe(400);
      expect(json?.error).toBe("Invalid JSON body");
    });

    it("POST /socialflow returns 400 for missing JSON body", async () => {
      const response = await handler.handleRequest(buildRequest("/socialflow", "POST", true), env);
      const { json } = await readResponse(response);

      expect(response.status).toBe(400);
      expect(json?.error).toBe("Invalid JSON body");
    });
  });

  describe("host fencing still applies", () => {
    it("unknown host returns HOSTS_FENCING_REJECTED even for public route", async () => {
      const response = await handler.handleRequest(buildRequest("/", "GET", false, "evil.example.com"), env);
      const { json } = await readResponse(response);

      expect(response.status).toBe(403);
      expect(json?.errorCode).toBe("HOSTS_FENCING_REJECTED");
    });
  });

  describe("HTML content validation", () => {
    it("public HTML contains required content elements", async () => {
      const response = await handler.handleRequest(buildRequest("/", "GET", false), env);
      const { text } = await readResponse(response);

      expect(text).toContain("<!DOCTYPE html>");
      expect(text).toContain("SocialFlow");
      expect(text).toContain("Convierte tu operación social en un sistema asistido por IA.");
      expect(text).toContain("IA + redes sociales");
      expect(text).toContain("planificar, preparar, revisar y coordinar contenido social");
      expect(text).toContain("SocialFlow Workspace");
      expect(text).toContain("Antes / después");
      expect(text).toContain("Cómo funciona");
      expect(text).toContain("Bloque visual plataforma");
      expect(text).toContain("SocialFlow Control Room");
      expect(text).toContain("Borradores asistidos por IA");
      expect(text).toContain("canales temáticos");
      expect(text).toContain("Calendario editorial");
      expect(text).toContain("LinkedIn");
      expect(text).toContain("Instagram");
      expect(text).toContain("Canal conversación");
      expect(text).toContain("Idea");
      expect(text).toContain("Borrador");
      expect(text).toContain("Revisión");
      expect(text).toContain("Programado");
      expect(text).toContain("Aprobación humana");
      expect(text).toContain("Control humano antes de publicar");
      expect(text).toContain("Operación asistida por IA");
      expect(text).toContain("Empresas");
      expect(text).toContain("Equipos de marketing");
      expect(text).toContain("Agencias pequeñas");
      expect(text).toContain("Emprendedores");
      expect(text).toContain("Marcas personales");
      expect(text).toContain("Negocios locales");
      expect(text).toContain("Solicitar piloto");
      expect(text).toContain("Ver cómo funciona");
      expect(text).toContain("https://drako.systems/contact");
      expect(text).toContain("Acceso cliente: próximamente");
      expect(text).toContain("Piloto controlado");
      expect(text).toContain("Para quién es");
      expect(text).toContain("Qué automatiza");
      expect(text).toContain("Organización temática");
      expect(text).toContain("Priorización de canales");
      expect(text).toContain("Preparación para publicación");
      expect(text).toContain("Estado real del producto");
      expect(text).toContain("Disponible ahora");
      expect(text).toContain("En validación");
      expect(text).toContain("No prometemos todavía");
      expect(text).toContain("Cloudflare-first");
      expect(text).toContain("Sin trackers");
      expect(text).toContain("APIs protegidas");
      expect(text).toContain("Control humano");
      expect(text).toContain("No publicación automática sin revisión");
      expect(text).toContain("No integraciones no verificadas como producción");
      expect(text).toContain("No resultados virales garantizados");
      expect(text).toContain("No sustituye estrategia humana");
    });

    it("public HTML is responsive and has proper meta tags", async () => {
      const response = await handler.handleRequest(buildRequest("/", "GET", false), env);
      const { text } = await readResponse(response);

      expect(text).toContain('<meta charset="UTF-8">');
      expect(text).toContain('<meta name="viewport"');
      expect(text).toContain("@media (max-width: 768px)");
    });

    it("public HTML has no external dependencies", async () => {
      const response = await handler.handleRequest(buildRequest("/", "GET", false), env);
      const { text } = await readResponse(response);

      expect(text).not.toContain("<script src=");
      expect(text).not.toContain("<script");
      expect(text).not.toContain("<link rel=\"stylesheet\" href=");
      expect(text).not.toContain("google-analytics");
      expect(text).not.toContain("gtag");
      expect(text).not.toContain("googletagmanager");
      expect(text).not.toContain("facebook.net");
      expect(text).not.toContain("analytics.js");
      expect(text).not.toContain("plausible.io");
    });
  });
});
