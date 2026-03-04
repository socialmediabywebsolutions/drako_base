export const dynamic = "force-dynamic";

import { NextResponse } from "next/server";
import { requireOwnerAccess, UnauthorizedError } from "@/lib/auth/session";
import { getCloudflareEnv } from "@/lib/cloudflare/context";


// GET: Returns all agent states
export async function GET(request: Request) {
    try {
        const { tenantId: _tenantId } = await requireOwnerAccess(request);
        const db = getCloudflareEnv().DB;
        if (!db) {
            return NextResponse.json({ error: "Database unavailable" }, { status: 503 });
        }

        const { results } = await db.prepare("SELECT * FROM agent_runtime_states ORDER BY role ASC").all();

        // Add offline detection (10 min threshold)
        const now = Math.floor(Date.now() / 1000);
        const OFFLINE_THRESHOLD = 10 * 60;
        const agentsWithStatus = results.map((agent: any) => ({
            ...agent,
            isOffline: (now - (agent.last_heartbeat || 0)) > OFFLINE_THRESHOLD,
        }));

        return NextResponse.json({ agents: agentsWithStatus });

    } catch (error) {
        if (error instanceof UnauthorizedError) {
            return NextResponse.json({ message: "Unauthorized" }, { status: 401 });
        }
        console.error("OWNER_AGENTS_GET_ERROR", error);
        return NextResponse.json({ message: "Internal Error" }, { status: 500 });
    }
}

// POST: Agent Heartbeat / Status Update
// Can be called by the agents themselves (with Service Token) or Owner UI (manual override)
// For simplicity in this phase, we use the same session auth, assuming Agents run in a context that can auth or we allow it.
// TODO: Add proper Service Token auth for autonomous agents.
export async function POST(request: Request) {
    try {
        // For Phase 2 manual testing, we allow Owner to force-set status via UI too.
        // In production, this should check for a valid "Agent-Token" header as well.
        const { tenantId: _tenantId } = await requireOwnerAccess(request);

        const body = await request.json() as any;
        const { agentId, role, status, currentTask, lastError, metadata } = body;

        if (!agentId || !role) {
            return NextResponse.json({ message: "Missing agentId or role" }, { status: 400 });
        }

        const db = getCloudflareEnv().DB;
        if (!db) {
            return NextResponse.json({ error: "Database unavailable" }, { status: 503 });
        }
        const now = Math.floor(Date.now() / 1000);

        await db.prepare(`
      INSERT INTO agent_runtime_states (agent_id, role, status, current_task, last_heartbeat, last_error, metadata_json, updated_at)
      VALUES (?, ?, ?, ?, ?, ?, ?, ?)
      ON CONFLICT(agent_id) DO UPDATE SET
        status = excluded.status,
        current_task = excluded.current_task,
        last_heartbeat = excluded.last_heartbeat,
        last_error = excluded.last_error,
        metadata_json = excluded.metadata_json,
        updated_at = excluded.updated_at
    `).bind(
            agentId,
            role,
            status || 'IDLE',
            currentTask || null,
            now,
            lastError || null,
            JSON.stringify(metadata || {}),
            now
        ).run();

        return NextResponse.json({ success: true, timestamp: now });

    } catch (error) {
        if (error instanceof UnauthorizedError) {
            return NextResponse.json({ message: "Unauthorized" }, { status: 401 });
        }
        console.error("OWNER_AGENTS_POST_ERROR", error);
        return NextResponse.json({ message: "Internal Error" }, { status: 500 });
    }
}
