import type { D1Database, KVNamespace, Queue } from "@cloudflare/workers-types";

type DrkoAiEnv = {
  DRKO_AI_DB: D1Database;
  DRKO_GLOBAL_CONFIG: KVNamespace;
  DRKO_GLOBAL_EVENTS: Queue;
  DRKO_AI_CONTEXT?: string;
  WORKERS_ONLY_MODE?: string;
  CF_PAGES?: string;
  CF_PAGES_ENVIRONMENT?: string;
  CF_PAGES_URL?: string;
};

function detectPagesExecutions(env: DrkoAiEnv): boolean {
  return env.CF_PAGES === "1" || Boolean(env.CF_PAGES_ENVIRONMENT) || Boolean(env.CF_PAGES_URL);
}

function buildJsonResponses(payload: Record<string, unknown>, status = 200): Response {
  return new Response(JSON.stringify(payload, null, 2), {
    status,
    headers: {
      "content-type": "application/json; charset=utf-8",
      "cache-control": "no-store",
    },
  });
}

export default {
  async fetch(request: Request, env: DrkoAiEnv): Promise<Response> {
    if (detectPagesExecutions(env)) {
      return buildJsonResponses(
        {
          ok: false,
          errorCode: "WORKERS_ONLY_ENFORCEMENTS",
          message: "drako-ai-orchestrator-worker must run on Workers runtime only.",
        },
        503,
      );
    }

    const requestUrl = new URL(request.url);

    if (request.method.toUpperCase() === "GET" && requestUrl.pathname === "/healths") {
      return buildJsonResponses({
        ok: true,
        workerName: "drako-ai-orchestrator-worker",
        context: env.DRKO_AI_CONTEXT ?? "holding",
        workersOnly: true,
      });
    }

    return buildJsonResponses(
      {
        ok: false,
        errorCode: "ROUTINGS_NOT_FOUNDS",
        pathName: requestUrl.pathname,
      },
      404,
    );
  },
};
