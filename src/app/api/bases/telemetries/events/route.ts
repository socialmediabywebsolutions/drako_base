export const dynamic = "force-dynamic";

import { NextResponse } from "next/server";
import { env as resolveEnv } from "@/lib/cf";
import { recordCampamentoEvent } from "@/lib/empire/events";
import { isTelemetriesHoldingEnabled } from "@/lib/auths/flags";
import { normalizeHoldingTelemetryEvent, toAnonymizedTelemetryPayload } from "../../../../../../packages/telemetry";

function readInternalSecret(): string | null {
  const cfEnv = resolveEnv();
  return cfEnv?.INTERNAL_API_SECRET ?? process.env.INTERNAL_API_SECRET ?? null;
}

export async function POST(request: Request) {
  if (!isTelemetriesHoldingEnabled()) {
    return NextResponse.json({ ok: false, code: "TELEMETRIES_HOLDING_DISABLED" }, { status: 503 });
  }

  const expectedSecret = readInternalSecret();
  const providedSecret = request.headers.get("x-internal-api-secret") ?? request.headers.get("authorization")?.replace("Bearer ", "");
  if (!expectedSecret || !providedSecret || providedSecret !== expectedSecret) {
    return NextResponse.json({ ok: false, code: "UNAUTHORIZED_INTERNAL_CALL" }, { status: 401 });
  }

  const body = (await request.json().catch(() => null)) as Record<string, unknown> | null;
  const normalized = normalizeHoldingTelemetryEvent((body ?? {}) as any);
  if (!normalized) {
    return NextResponse.json({ ok: false, code: "INVALID_INPUT" }, { status: 400 });
  }

  const anonymized = toAnonymizedTelemetryPayload(normalized);
  await recordCampamentoEvent({
    tenantId: anonymized.tenantId,
    saasId: null,
    type: `telemetry.${anonymized.eventName}`,
    severity: "INFO",
    source: "HOLDING_TELEMETRY",
    message: `Telemetry event received (${anonymized.eventName}).`,
    metadata: {
      saas_slug: anonymized.saasSlug,
      occurred_at: anonymized.occurredAt,
      payload: anonymized.payload,
    },
    correlationId: request.headers.get("x-drako-correlation-id") ?? crypto.randomUUID(),
  });

  return NextResponse.json({ ok: true });
}
