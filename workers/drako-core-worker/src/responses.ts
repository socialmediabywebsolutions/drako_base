export function buildJsonResponses(payload: unknown, status = 200, headers?: HeadersInit): Response {
  return new Response(JSON.stringify(payload, null, 2), {
    status,
    headers: {
      "content-type": "application/json; charset=utf-8",
      "cache-control": "no-store",
      ...headers,
    },
  });
}

export async function readJsonBodies(request: Request): Promise<Record<string, unknown>> {
  return (await request.json().catch(() => ({}))) as Record<string, unknown>;
}

export function readRequestIds(request: Request): string {
  return request.headers.get("x-request-id") ?? request.headers.get("cf-ray") ?? crypto.randomUUID();
}

export function readRequestIps(request: Request): string | null {
  return request.headers.get("cf-connecting-ip") ?? request.headers.get("x-forwarded-for") ?? null;
}
