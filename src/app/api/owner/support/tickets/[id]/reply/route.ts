export const dynamic = "force-dynamic";
import { NextResponse } from "next/server";
import { requireTenantAccess } from "@/lib/auth/session";
import { getCloudflareEnv } from "@/lib/cloudflare/context";

type ReplyRequest = {
    message: string;
};

/**
 * POST /api/owner/support/tickets/[id]/reply
 * Owner replies to a support ticket
 * Creates entry in ticket_messages table and logs event
 */
export async function POST(
    request: Request,
    { params }: { params: Promise<{ id: string }> }
): Promise<Response> {
    try {
        const { tenantId } = await requireTenantAccess(request);
        const { id } = await params;
        const body = (await request.json()) as ReplyRequest;
        const { message } = body;

        if (!message || message.trim().length === 0) {
            return NextResponse.json(
                { ok: false, error: "Message required" },
                { status: 400 }
            );
        }

        const db = getCloudflareEnv().DB;
        if (!db) {
            return NextResponse.json({ error: "Database unavailable" }, { status: 503 });
        }
        const now = Math.floor(Date.now() / 1000);
        const correlation_id = crypto.randomUUID();
        const message_id = crypto.randomUUID();

        // Verify ticket exists
        const ticket = (await db
            .prepare("SELECT * FROM tickets WHERE id = ?")
            .bind(id)
            .first()) as any;

        if (!ticket) {
            return NextResponse.json(
                { ok: false, error: "Ticket not found" },
                { status: 404 }
            );
        }

        // Insert message
        await db
            .prepare(
                `INSERT INTO ticket_messages (id, ticket_id, author_type, author_id, message, created_at)
         VALUES (?, ?, ?, ?, ?, ?)`
            )
            .bind(message_id, id, "OWNER", tenantId, message.trim(), now)
            .run();

        // Update ticket updated_at
        await db
            .prepare("UPDATE tickets SET updated_at = ? WHERE id = ?")
            .bind(now, id)
            .run();

        // Log event
        await db
            .prepare(
                `INSERT INTO events (correlation_id, type, severity, message, metadata_json, created_at)
         VALUES (?, ?, ?, ?, ?, ?)`
            )
            .bind(
                correlation_id,
                "TICKET_REPLY",
                "INFO",
                `Owner replied to ticket: ${ticket.title}`,
                JSON.stringify({
                    ticket_id: id,
                    message_id,
                    author_id: tenantId,
                    ticket_title: ticket.title,
                }),
                now
            )
            .run();

        return NextResponse.json({
            ok: true,
            message_id,
            correlation_id,
            ticket_id: id,
        });
    } catch (error) {
        console.error("Reply error:", error);
        return NextResponse.json(
            { ok: false, error: "Internal error" },
            { status: 500 }
        );
    }
}
