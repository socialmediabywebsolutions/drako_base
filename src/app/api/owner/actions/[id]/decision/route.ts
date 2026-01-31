import { NextResponse } from "next/server";
import { requireTenantAccess } from "@/lib/auth/session";
import { getCloudflareEnv } from "@/lib/cloudflare/context";

type DecisionRequest = {
    decision: "APPROVE" | "REJECT";
    note?: string;
};

/**
 * POST /api/owner/actions/[id]/decision
 * Approve or reject an action from the action queue
 * Logs decision to events table with correlation_id
 */
export async function POST(
    request: Request,
    { params }: { params: Promise<{ id: string }> }
): Promise<Response> {
    try {
        const { tenantId } = await requireTenantAccess(request);
        const { id } = await params;
        const body = (await request.json()) as DecisionRequest;
        const { decision, note } = body;

        if (!decision || !["APPROVE", "REJECT"].includes(decision)) {
            return NextResponse.json(
                { ok: false, error: "Valid decision required (APPROVE or REJECT)" },
                { status: 400 }
            );
        }

        const db = getCloudflareEnv().DB;
        const now = Math.floor(Date.now() / 1000);
        const correlation_id = crypto.randomUUID();

        // Get the action first
        const action = (await db
            .prepare("SELECT * FROM campamento_actions WHERE id = ?")
            .bind(id)
            .first()) as any;

        if (!action) {
            return NextResponse.json(
                { ok: false, error: "Action not found" },
                { status: 404 }
            );
        }

        // Update action status
        const newStatus = decision === "APPROVE" ? "APPROVED" : "REJECTED";
        await db
            .prepare(
                `UPDATE campamento_actions 
         SET status = ?, resolved_at = ?, resolved_by = ?, resolution_note = ?
         WHERE id = ?`
            )
            .bind(newStatus, now, tenantId, note || null, id)
            .run();

        // Log decision event
        await db
            .prepare(
                `INSERT INTO events (correlation_id, type, severity, message, metadata_json, created_at)
         VALUES (?, ?, ?, ?, ?, ?)`
            )
            .bind(
                correlation_id,
                "ACTION_DECISION",
                decision === "APPROVE" ? "INFO" : "WARNING",
                `Action ${decision.toLowerCase()}d: ${action.title}`,
                JSON.stringify({
                    action_id: id,
                    decision,
                    note,
                    resolved_by: tenantId,
                    original_action: {
                        title: action.title,
                        category: action.category,
                        priority: action.priority,
                    },
                }),
                now
            )
            .run();

        return NextResponse.json({
            ok: true,
            decision,
            correlation_id,
            action_id: id,
            status: newStatus,
        });
    } catch (error) {
        console.error("Decision error:", error);
        return NextResponse.json(
            { ok: false, error: "Internal error" },
            { status: 500 }
        );
    }
}
