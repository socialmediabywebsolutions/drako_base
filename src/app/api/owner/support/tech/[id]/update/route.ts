import { NextResponse } from "next/server";
import { requireTenantAccess } from "@/lib/auth/session";
import { getRequestContext } from "@cloudflare/next-on-pages";

type UpdateRequest = {
    status?: "OPEN" | "INVESTIGATING" | "RESOLVED" | "MONITORING";
    note?: string;
    severity?: "CRITICAL" | "HIGH" | "MEDIUM" | "LOW";
};

/**
 * POST /api/owner/support/tech/[id]/update
 * Update tech incident status/severity
 * Logs update to events table with correlation_id
 */
export async function POST(
    request: Request,
    { params }: { params: { id: string } }
): Promise<Response> {
    try {
        const { tenantId, session } = await requireTenantAccess(request);
        const { id } = params;
        const body = (await request.json()) as UpdateRequest;
        const { status, note, severity } = body;

        if (!status && !severity && !note) {
            return NextResponse.json(
                { ok: false, error: "At least one update field required" },
                { status: 400 }
            );
        }

        const db = getRequestContext().env.DB as any;
        const now = Math.floor(Date.now() / 1000);
        const correlation_id = crypto.randomUUID();

        // Get current incident
        const incident = await db
            .prepare("SELECT * FROM tech_incidents WHERE id = ?")
            .bind(id)
            .first();

        if (!incident) {
            return NextResponse.json(
                { ok: false, error: "Incident not found" },
                { status: 404 }
            );
        }

        // Build update query dynamically
        const updates: string[] = [];
        const binds: any[] = [];

        if (status) {
            updates.push("status = ?");
            binds.push(status);
        }
        if (severity) {
            updates.push("severity = ?");
            binds.push(severity);
        }
        if (note) {
            updates.push("description = ?");
            binds.push(note);
        }

        updates.push("last_seen_at = ?");
        binds.push(now);

        binds.push(id);

        await db
            .prepare(`UPDATE tech_incidents SET ${updates.join(", ")} WHERE id = ?`)
            .bind(...binds)
            .run();

        // Log event
        await db
            .prepare(
                `INSERT INTO events (correlation_id, type, severity, message, metadata_json, created_at)
         VALUES (?, ?, ?, ?, ?, ?)`
            )
            .bind(
                correlation_id,
                "INCIDENT_UPDATE",
                severity || incident.severity,
                `Incident updated: ${incident.title}`,
                JSON.stringify({
                    incident_id: id,
                    service: incident.service,
                    old_status: incident.status,
                    new_status: status,
                    old_severity: incident.severity,
                    new_severity: severity,
                    note,
                    updated_by: tenantId,
                }),
                now
            )
            .run();

        return NextResponse.json({
            ok: true,
            incident_id: id,
            correlation_id,
            updated: { status, severity, note },
        });
    } catch (error) {
        console.error("Incident update error:", error);
        return NextResponse.json(
            { ok: false, error: "Internal error" },
            { status: 500 }
        );
    }
}
