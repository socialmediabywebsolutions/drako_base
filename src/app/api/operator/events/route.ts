export const dynamic = "force-dynamic";

import { NextResponse } from "next/server";
import { UnauthorizedError, requireOwnerAccess } from "@/lib/auth/session";
import { queryAll } from "@/lib/db";
import { triggerOperatorRealtimeWhatsappAlertForMentoriaEvent } from "@/lib/campamento-base/operator-whatsapp-notifications";


type CriticalEventRow = {
  type: string;
  severity: string;
  message: string;
  created_at: string;
  correlation_id: string;
  saas_slug: string | null;
  saas_id: string | null;
};

type RollupRow = {
  day: string;
  saas_slug: string | null;
  type: string;
  severity: string;
  count: number;
  first_seen_at: string;
  last_seen_at: string;
};

function isoDaysAgo(days: number): string {
  const target = new Date(Date.now() - days * 24 * 60 * 60 * 1000);
  return target.toISOString().slice(0, 10);
}

export async function GET(request: Request) {
  try {
    const { tenantId } = await requireOwnerAccess(request);
    const criticalEvents = await queryAll<CriticalEventRow>(
      `SELECT e.type, e.severity, e.message, e.created_at, e.correlation_id, s.slug AS saas_slug, e.saas_id
       FROM campamento_events e
       LEFT JOIN saas s ON s.id = e.saas_id AND s.tenant_id = e.tenant_id
       WHERE e.tenant_id = ?
         AND (e.severity = 'CRITICAL' OR e.type LIKE 'security.%')
       ORDER BY e.created_at DESC
       LIMIT 20`,
      tenantId,
    );

    const dayCutoff = isoDaysAgo(14);
    let rollups: RollupRow[] = [];
    try {
      rollups = await queryAll<RollupRow>(
        `SELECT day, saas_slug, type, severity, count, first_seen_at, last_seen_at
         FROM campamento_event_rollups_daily
         WHERE tenant_id = ?
           AND day >= ?
         ORDER BY day DESC, severity DESC`,
        tenantId,
        dayCutoff,
      );
    } catch (err) {
      // Fallback seguro si la tabla de rollups no existe aún (migraciones de workers no aplicadas)
      console.warn("OPERATOR_EVENTS_ROLLUPS_FALLBACK", { message: (err as Error).message });
      rollups = [];
    }

    const mentoriaCriticalEvent = criticalEvents.find((event) =>
      event.severity === "CRITICAL" && event.type.startsWith("mentoria.system."),
    );
    if (mentoriaCriticalEvent) {
      try {
        await triggerOperatorRealtimeWhatsappAlertForMentoriaEvent({
          operatorTenantId: tenantId,
          eventType: mentoriaCriticalEvent.type,
          severity: mentoriaCriticalEvent.severity,
          saasId: mentoriaCriticalEvent.saas_id,
        });
      } catch (triggerError) {
        console.error("OPERATOR_EVENTS_MENTORIA_WHATSAPP_TRIGGER_ERROR", triggerError);
      }
    }

    return NextResponse.json({ criticalEvents, rollups });
  } catch (error) {
    if (error instanceof UnauthorizedError) {
      return NextResponse.json({ code: "UNAUTHORIZED", message: error.message }, { status: error.status });
    }
    console.error("OWNER_EVENTS_ERROR", error);
    return NextResponse.json({ code: "OWNER_EVENTS_ERROR", message: "No se pudieron cargar los eventos" }, { status: 500 });
  }
}
