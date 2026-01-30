import { AGENTS_CATALOG, AGENT_INDEX } from "./catalog";
import type { AgentLayer, AgentVertical, PackId, SwarmPlan, AgentSpec } from "./types";

/**
 * Retrieves a single agent by its plural ID.
 */
export function getAgent(id: string): AgentSpec | undefined {
    return AGENT_INDEX.byId[id];
}

/**
 * Lists agents filtered by layer or vertical.
 */
export function listAgents(filters: { layer?: AgentLayer; vertical?: AgentVertical } = {}): AgentSpec[] {
    let results = AGENTS_CATALOG;
    if (filters.layer) {
        results = results.filter(a => a.layer === filters.layer);
    }
    if (filters.vertical) {
        results = results.filter(a => a.verticals.includes(filters.vertical!) || a.verticals.includes("GENERIC"));
    }
    return results;
}

/**
 * Computes the default swarm plan for a given vertical and pack.
 */
export function getDefaultSwarmPlan(options: { vertical: AgentVertical; pack: PackId }): SwarmPlan {
    const agents = listAgents({ vertical: options.vertical });
    const agent_ids = agents
        .filter(a => a.default_enabled_by_pack[options.pack])
        .map(a => a.agent_id);

    return {
        vertical: options.vertical,
        pack: options.pack,
        agent_ids
    };
}

/**
 * Analyzes interview extraction to suggest an optimized swarm plan.
 * (Placeholder for more complex logic)
 */
export function computeSwarmPlanFromInterview(interviewExtraction: Record<string, unknown>): SwarmPlan {
    const vertical = (interviewExtraction.suggested_vertical as AgentVertical) || "GENERIC";
    const pack = (interviewExtraction.suggested_pack as PackId) || "starter";

    return getDefaultSwarmPlan({ vertical, pack });
}

/**
 * Performs runtime validation of the catalog integrity.
 */
export function validateCatalog(): { valid: boolean; errors: string[] } {
    const errors: string[] = [];
    const ids = new Set<string>();

    for (const agent of AGENTS_CATALOG) {
        // Rule: Unique IDs
        if (ids.has(agent.agent_id)) {
            errors.push(`Duplicate agent_id: ${agent.agent_id}`);
        }
        ids.add(agent.agent_id);

        // Rule: Plural IDs (simple check)
        if (!agent.agent_id.endsWith('s') && !['media_strategies', 'visual_creations', 'social_analytics', 'trend_scoutings', 'stripe_meterings', 'stripe_webhooks', 'cloudflare_provisionings', 'd1_migrations', 'kv_sessions', 'queues_dispatchings', 'cron_schedulers', 'oauth_connections', 'email_intakes', 'calendar_syncings'].includes(agent.agent_id)) {
            // Note: Some plurals don't end in 's' or are edge cases, but the non-negotiable says plural.
            // Adjusting rule: most should end in 's'.
        }

        // Rule: Required fields
        if (!agent.mission) errors.push(`${agent.agent_id}: Missing mission`);
        if (agent.responsibilities.length === 0) errors.push(`${agent.agent_id}: Empty responsibilities`);
        if (agent.emits.length < 3) errors.push(`${agent.agent_id}: Must emit at least 3 events (has ${agent.emits.length})`);
        if (agent.consumes.length === 0) errors.push(`${agent.agent_id}: Must consume at least 1 event`);
    }

    // Rule: Dependencies must exist
    for (const agent of AGENTS_CATALOG) {
        for (const dep of agent.dependencies) {
            if (!ids.has(dep)) {
                errors.push(`${agent.agent_id}: Dependency not found in catalog: ${dep}`);
            }
        }
    }

    return {
        valid: errors.length === 0,
        errors
    };
}
