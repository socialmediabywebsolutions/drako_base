import { env } from '@/lib/cf';
import type { StrategicDossier, SaaSBlueprint } from './types';

/**
 * PROVISIONER ENGINE (The Factory)
 * Materializes SaaS Instances from Blueprints.
 */
export async function provisionSaaS(tenantId: string, dossier: StrategicDossier) {
    const bindings = env();
    const db = bindings?.DRACO_DB;

    if (!db) throw new Error("Database Binding Not Found (DRACO_DB)");
    if (!dossier.plan_data) throw new Error("Cannot provision without a Blueprint (plan_data missing)");

    const blueprint = dossier.plan_data;
    const slug = generateSlug(dossier.form_data.business.type, tenantId); // Simple slug generation

    // 1. Create SaaS Instance Record
    const instanceId = crypto.randomUUID();
    const trialEndsAt = new Date();
    trialEndsAt.setDate(trialEndsAt.getDate() + 30); // 30 Day Trial

    try {
        await db.prepare(`
            INSERT INTO saas_instances (
                id, tenant_id, name, slug, 
                status, blueprint_snapshot, 
                trial_started_at, trial_ends_at, plan_tier
            ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?)
        `).bind(
            instanceId,
            tenantId,
            blueprint.tagline, // Using tagline as instance name/title for now
            slug,
            'trial_active',
            JSON.stringify(blueprint),
            new Date().toISOString(),
            trialEndsAt.toISOString(),
            'trial'
        ).run();

        // 2. Activate Core Agents (Standard + Blueprint Modules)
        const agents = [
            { type: 'orchestrator', name: 'Drako Core' },
            { type: 'planner', name: 'Strategy Engine' },
            // Add Blueprint specific agents if modules map to them
            ...(blueprint.modules.some(m => m.name.toLowerCase().includes('crm')) ? [{ type: 'sales_rep', name: 'Sales AI' }] : []),
            ...(blueprint.modules.some(m => m.name.toLowerCase().includes('marketing')) ? [{ type: 'marketing_lead', name: 'Growth Bot' }] : []),
            // Always active AI Core
            { type: 'ai_core', name: 'Neural Fabric' }
        ];

        const agentStmts = agents.map(agent => db.prepare(`
            INSERT INTO saas_agents (id, instance_id, type, name, status, created_at)
            VALUES (?, ?, ?, ?, 'active', ?)
        `).bind(
            crypto.randomUUID(),
            instanceId,
            agent.type,
            agent.name,
            new Date().toISOString()
        ));

        await db.batch(agentStmts);

        return { success: true, instanceId, slug, trialEndsAt };

    } catch (e) {
        console.error("Provisioning Failed", e);
        throw new Error("Factory Provisioning Failed");
    }
}

function generateSlug(name: string, tenantId: string): string {
    const cleanName = name.toLowerCase().replace(/[^a-z0-9]/g, '-');
    const shortId = tenantId.split('-')[0]; // First segment of UUID
    return `${cleanName}-${shortId}`;
}
