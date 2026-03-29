import {
  buildClearSessionCookieHeaders,
  buildSessionCookieHeaders,
  createSessionTokens,
  readSessionClaimsFromRequests,
  type AuthsRoles,
} from "./auths-isolations";
import { renderAdminDashboards, renderClientDashboards } from "./dashboards-templates";
import { enforceHostsFencings } from "./hosts-fencings";
import { buildWorkersOnlyFailures, detectPagesExecutions } from "./platforms-failures";

export type WorkersHandlersConfig = {
  saasSlug: string;
  workerName: string;
  domainName: string;
  aliasDomainNames?: string[];
  authsSecretName: string;
  allSaasesSlugs: string[];
};

export type WorkersHandlersEnv = Record<string, unknown> & {
  GIT_SHA?: string;
};

function buildJsonResponses(payload: unknown, status = 200, headers?: HeadersInit): Response {
  return new Response(JSON.stringify(payload, null, 2), {
    status,
    headers: {
      "content-type": "application/json; charset=utf-8",
      "cache-control": "no-store",
      ...headers,
    },
  });
}

function readSecrets(runtimeEnv: WorkersHandlersEnv, secretName: string): string {
  const secretValue = runtimeEnv[secretName];
  return typeof secretValue === "string" ? secretValue : "";
}

async function readJsonBodies(request: Request): Promise<Record<string, unknown>> {
  return (await request.json().catch(() => ({}))) as Record<string, unknown>;
}

export function createWorkersHandlers(config: WorkersHandlersConfig) {
  const allowedHostNames = [config.domainName, ...(config.aliasDomainNames ?? [])];

  return {
    async fetch(request: Request, runtimeEnv: WorkersHandlersEnv): Promise<Response> {
      if (detectPagesExecutions(runtimeEnv)) {
        return buildWorkersOnlyFailures(config.workerName);
      }

      const hostFencings = enforceHostsFencings({ request, allowedHostNames, workerName: config.workerName });
      if (hostFencings.ok === false) return hostFencings.response;

      const requestUrl = new URL(request.url);
      const requestPathName = requestUrl.pathname;
      const requestMethod = request.method.toUpperCase();
      const authsSecrets = readSecrets(runtimeEnv, config.authsSecretName);

      if (!authsSecrets) {
        return buildJsonResponses(
          {
            ok: false,
            errorCode: "AUTHS_SECRETS_MISSINGS",
            workerName: config.workerName,
            authsSecretName: config.authsSecretName,
          },
          500,
        );
      }

      if (requestMethod === "GET" && requestPathName === "/api/health") {
        return buildJsonResponses({
          ok: true,
          host: hostFencings.hostName,
          resolvedContext: config.saasSlug,
          workerName: config.workerName,
          gitSha: typeof runtimeEnv.GIT_SHA === "string" ? runtimeEnv.GIT_SHA : "unknown",
          workersOnly: true,
        });
      }

      if (requestMethod === "POST" && requestPathName === "/api/auths/logins") {
        const body = await readJsonBodies(request);
        const email = String(body.email ?? "").trim().toLowerCase();
        const sub = String(body.sub ?? body.userId ?? crypto.randomUUID());
        const tenantId = String(body.tenantId ?? "default-tenants");
        const role = String(body.role ?? "clients") as AuthsRoles;
        if (!email) {
          return buildJsonResponses({ ok: false, errorCode: "EMAILS_REQUIREDS" }, 400);
        }

        const token = await createSessionTokens({
          saasSlug: config.saasSlug,
          secrets: authsSecrets,
          sub,
          email,
          tenantId,
          role: role === "admins" ? "admins" : "clients",
        });

        return buildJsonResponses(
          {
            ok: true,
            context: config.saasSlug,
            workerName: config.workerName,
            host: hostFencings.hostName,
          },
          200,
          {
            "set-cookie": buildSessionCookieHeaders({ saasSlug: config.saasSlug, tokens: token }),
          },
        );
      }

      if (requestMethod === "POST" && requestPathName === "/api/auths/logouts") {
        return buildJsonResponses(
          { ok: true, context: config.saasSlug, workerName: config.workerName },
          200,
          {
            "set-cookie": buildClearSessionCookieHeaders({ saasSlug: config.saasSlug }),
          },
        );
      }

      if (requestMethod === "GET" && requestPathName === "/api/auths/sessions") {
        const sessionResult = await readSessionClaimsFromRequests({
          request,
          saasSlug: config.saasSlug,
          allSaasesSlugs: config.allSaasesSlugs,
          secrets: authsSecrets,
        });
        if (sessionResult.ok === false) {
          return buildJsonResponses(
            { ok: false, errorCode: sessionResult.errorCode, context: config.saasSlug },
            401,
          );
        }

        return buildJsonResponses({ ok: true, claims: sessionResult.claims, context: config.saasSlug });
      }

      if ((requestMethod === "GET" && requestPathName === "/") || requestPathName === "/clients") {
        return new Response(
          renderClientDashboards({
            saasSlug: config.saasSlug,
            workerName: config.workerName,
            hostName: hostFencings.hostName,
          }),
          {
            status: 200,
            headers: { "content-type": "text/html; charset=utf-8", "cache-control": "no-store" },
          },
        );
      }

      if (requestMethod === "GET" && requestPathName === "/admins") {
        return new Response(
          renderAdminDashboards({
            saasSlug: config.saasSlug,
            workerName: config.workerName,
            hostName: hostFencings.hostName,
          }),
          {
            status: 200,
            headers: { "content-type": "text/html; charset=utf-8", "cache-control": "no-store" },
          },
        );
      }

      if (requestMethod === "GET" && requestPathName === "/logins") {
        return Response.redirect(new URL("/clients", request.url), 308);
      }

      return buildJsonResponses(
        {
          ok: false,
          errorCode: "ROUTINGS_NOT_FOUNDS",
          context: config.saasSlug,
          workerName: config.workerName,
          pathName: requestPathName,
        },
        404,
      );
    },
  };
}
