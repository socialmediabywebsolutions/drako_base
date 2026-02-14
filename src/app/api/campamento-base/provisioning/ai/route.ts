import { NextResponse } from "next/server";
import {  run } from "@/lib/db";
import { AGENT_PACKS_BY_DEPARTMENT, DepartmentId } from "@/lib/agents/agent-templates";


/**
 * POST /api/campamento-base/provisioning/ai
 * Materializa la arquitectura neural del SaaS
 */
export async function POST(request: Request) {
    const tenantId = request.headers.get("x-drako-tenant-id");

    if (!tenantId) {
        return NextResponse.json({ error: "Missing tenant context" }, { status: 400 });
    }

    try {
        const body = (await request.json()) as {
            saasId: string;
            strategy: "BALANCED" | "QUALITY";
            packs: Record<string, string>;
        };
        const { saasId, strategy, packs } = body;

        if (!saasId || !packs) {
            return NextResponse.json(
                { error: "Missing required fields: saasId, packs" },
                { status: 400 },
            );
        }

        // 1. Simular recuperación de contexto de negocio (en producción vendría de la DB)
        // Por ahora usamos datos genéricos ya que estamos en modo Foundry
        const businessContext = {
            name: saasId.split('-').map(w => w.charAt(0).toUpperCase() + w.slice(1)).join(' '),
            vision: "Materializado vía Drako Forge Neural Layer"
        };

        const materializedAgents = [];

        // 2. Iterar sobre los packs seleccionados para materializar agentes
        for (const [deptId, tier] of Object.entries(packs)) {
            const packDef = AGENT_PACKS_BY_DEPARTMENT.find(
                p => p.departmentId === (deptId.toUpperCase() as DepartmentId) && p.tier === tier
            );

            if (!packDef) continue;

            for (const agentDef of packDef.agents) {
                const agentId = `${saasId}_${agentDef.key}`;
                const coreAgentId = agentDef.coreAgentId || "core_agent_support";

                // 3. Generar System Prompt "Bespoke"
                const systemPrompt = `
# ROLE: ${agentDef.roleName}
## MISSION: ${agentDef.description}
## CONTEXT: Estás operando dentro de "${businessContext.name}".
## STRATEGY: ${strategy === 'QUALITY' ? 'Análisis profundo y creativo. No escatimar en detalles técnicos.' : 'Directo, eficiente y orientado a la acción.'}

REGLAS CRÍTICAS:
1. Todas tus respuestas deben alinearse con la visión: "${businessContext.vision}".
2. Utiliza un tono profesional, técnico y resolutivo.
3. Si no tienes datos suficientes, solicita clarificación antes de asumir.

PROPIEDADES NEURALES:
- Kernel: Llama 3.1 70B
- Latency: Optimized
- Access: Secure_Channel_v4
                `.trim();

                const config = JSON.stringify({
                    systemPrompt,
                    strategy,
                    tier: agentDef.aiProfile?.tier || "BALANCED",
                    materializedAt: new Date().toISOString()
                });

                // 4. Persistence logic
                // Nota: Usamos INSERT OR REPLACE para actualizar si ya existe
                await run(
                    `INSERT OR REPLACE INTO saas_agents (id, saas_id, core_agent_id, estado, config, assigned_at)
                     VALUES (?, ?, ?, 'activo', ?, strftime('%Y-%m-%dT%H:%M:%fZ','now'))`,
                    agentId, saasId, coreAgentId, config
                );

                materializedAgents.push({
                    key: agentDef.key,
                    name: agentDef.roleName,
                    dept: deptId
                });
            }
        }

        return NextResponse.json({
            success: true,
            message: `Materialización neural exitosa: ${materializedAgents.length} agentes activados.`,
            agents: materializedAgents
        });

    } catch (error) {
        console.error("NEURAL_PROVISIONING_ERROR", error);
        return NextResponse.json(
            {
                error: "Failed to materialize neural layer",
                message: error instanceof Error ? error.message : String(error),
            },
            { status: 500 },
        );
    }
}
