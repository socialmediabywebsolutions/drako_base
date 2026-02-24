export const dynamic = "force-dynamic";

import { NextResponse } from "next/server";
import { requireTenantAccess } from "@/lib/auth/session";
import { getCloudflareEnv } from "@/lib/cloudflare/context";

type OrchestratorRequest = {
    command: string;
    args?: string[];
    context?: Record<string, unknown>;
};

type OrchestratorResponse = {
    ok: boolean;
    reply: string;
    data?: unknown;
    correlation_id: string;
};

/**
 * POST /api/owner/orchestrator
 * Real command processor for Campamento Base Orchestrator chat
 * All commands generate audit events with correlation_id
 */
export async function POST(request: Request): Promise<Response> {
    try {
        const { tenantId } = await requireTenantAccess(request);
        const body = (await request.json()) as OrchestratorRequest;
        const { command, args = [], context = {} } = body;

        if (!command || typeof command !== "string") {
            return NextResponse.json(
                { ok: false, error: "Command required" },
                { status: 400 }
            );
        }

        const db = getCloudflareEnv().DB;
        if (!db) {
            return NextResponse.json({
                ok: false,
                error: "Database unavailable",
                correlation_id: crypto.randomUUID(),
            }, { status: 503 });
        }
        const correlation_id = crypto.randomUUID();
        const now = Math.floor(Date.now() / 1000);

        // Log command to events table
        await db
            .prepare(
                `INSERT INTO events (correlation_id, type, severity, message, metadata_json, created_at)
         VALUES (?, ?, ?, ?, ?, ?)`
            )
            .bind(
                correlation_id,
                "ORCHESTRATOR_COMMAND",
                "INFO",
                `Command: ${command}`,
                JSON.stringify({ command, args, context, owner_id: tenantId }),
                now
            )
            .run();

        // Parse and execute command
        const cmdLower = command.toLowerCase().trim();
        let reply = "";
        let data: unknown = null;

        if (cmdLower === "/brief") {
            // Execute brief: Summary of system state
            const [actions, incidents, agents, events] = await Promise.all([
                db.prepare("SELECT COUNT(*) as count FROM campamento_actions WHERE status = 'OPEN'").first(),
                db.prepare("SELECT COUNT(*) as count FROM tech_incidents WHERE status != 'RESOLVED'").first(),
                db.prepare("SELECT COUNT(*) as count FROM agent_runtime_states").first(),
                db.prepare("SELECT COUNT(*) as count FROM events WHERE severity = 'CRITICAL' AND created_at > ?")
                    .bind(now - 24 * 3600)
                    .first(),
            ]);

            reply = `📊 BRIEF EJECUTIVO:\n` +
                `• Acciones pendientes: ${(actions as any)?.count ?? 0}\n` +
                `• Incidentes abiertos: ${(incidents as any)?.count ?? 0}\n` +
                `• Agentes activos: ${(agents as any)?.count ?? 0}\n` +
                `• Alertas critical (24h): ${(events as any)?.count ?? 0}`;

            data = { actions, incidents, agents, events };
        } else if (cmdLower === "/alerts") {
            const { results } = await db
                .prepare("SELECT * FROM events WHERE severity IN ('CRITICAL', 'HIGH') ORDER BY created_at DESC LIMIT 5")
                .all();

            reply = results.length > 0
                ? `🚨 ALERTAS RECIENTES (${results.length}):\n` + results.map((e: any) => `• ${e.type}: ${e.message}`).join("\n")
                : "Sin alertas críticas recientes.";

            data = results;
        } else if (cmdLower === "/actions") {
            const { results } = await db
                .prepare("SELECT id, title, priority, category FROM campamento_actions WHERE status = 'OPEN' ORDER BY priority DESC LIMIT 5")
                .all();

            reply = results.length > 0
                ? `⚡ ACCIONES PENDIENTES (${results.length}):\n` + results.map((a: any) => `• [${a.priority}] ${a.title}`).join("\n")
                : "No hay acciones pendientes.";

            data = results;
        } else if (cmdLower === "/agents") {
            const { results } = await db
                .prepare("SELECT role, status, current_task FROM agent_runtime_states ORDER BY role ASC")
                .all();

            reply = results.length > 0
                ? `🤖 AGENTES (${results.length}):\n` + results.map((a: any) => `• ${a.role}: ${a.status}${a.current_task ? ` - ${a.current_task}` : ""}`).join("\n")
                : "Sin agentes registrados.";

            data = results;
        } else if (cmdLower === "/support") {
            const [tickets, incidents] = await Promise.all([
                db.prepare("SELECT COUNT(*) as count FROM tickets WHERE status != 'CLOSED'").first(),
                db.prepare("SELECT COUNT(*) as count FROM tech_incidents WHERE status != 'RESOLVED'").first(),
            ]);

            reply = `💬 SOPORTE:\n` +
                `• Tickets abiertos: ${(tickets as any)?.count ?? 0}\n` +
                `• Incidentes técnicos: ${(incidents as any)?.count ?? 0}`;

            data = { tickets, incidents };
        } else if (cmdLower === "/profile") {
            const profile = (await db.prepare("SELECT * FROM owners WHERE id = ?").bind(tenantId).first()) as any;

            reply = profile
                ? `👤 PERFIL OWNER:\n• ${profile.name}\n• ${profile.nif ?? "Sin NIF"}\n• ${profile.email ?? "Sin email"}`
                : "Perfil no configurado.";

            data = profile;
        } else {
            reply = `Comando '${command}' no reconocido. Comandos disponibles: /brief, /alerts, /actions, /agents, /support, /profile`;
        }

        return NextResponse.json({
            ok: true,
            reply,
            data,
            correlation_id,
        } as OrchestratorResponse);
    } catch (error) {
        console.error("Orchestrator error:", error);
        return NextResponse.json(
            {
                ok: false,
                error: "Internal error",
                correlation_id: crypto.randomUUID(),
            },
            { status: 500 }
        );
    }
}
