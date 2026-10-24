import { crypto } from '@/lib/crypto-polyfill';

const COST_PER_AGENT_EUR = 5;

export async function computeUnitEconomics(db: any, instance: any) {
    try {
        // 1. Calculate Real Infra Cost (Agents)
        const agentCount = await db.prepare(`
            SELECT count(*) as count FROM saas_agents WHERE instance_id = ? AND status = 'active'
        `).bind(instance.id).first('count');

        const infraCost = (agentCount as number) * COST_PER_AGENT_EUR;

        // 2. AI Cost (If integrated, else 0 or estimated)
        // Future: Fetch from ai_cost_policies
        const aiCost = 0;

        const totalCostEur = infraCost + aiCost;
        const marginEur = (instance.mrr_eur || 0) - totalCostEur;
        const marginPct = instance.mrr_eur > 0 ? (marginEur / instance.mrr_eur) * 100 : -100;

        // 3. Determine Risk Level
        let riskLevel = 'low';
        const daysInTrial = getDaysInTrial(instance.trial_started_at);

        if (marginEur < 0 && daysInTrial > 20) {
            riskLevel = 'critical';
        } else if (marginEur < 0) {
            riskLevel = 'high';
        } else if (daysInTrial > 25 && instance.mrr_eur === 0) {
            riskLevel = 'medium';
        }

        // 4. Update DB
        await db.prepare(`
            UPDATE saas_instances SET 
                cost_eur = ?,
                margin_eur = ?,
                margin_pct = ?,
                risk_level = ?,
                last_overseer_run_at = ?
            WHERE id = ?
        `).bind(
            totalCostEur,
            marginEur,
            marginPct,
            riskLevel,
            new Date().toISOString(),
            instance.id
        ).run();

        // 5. Audit
        await db.prepare(`
            INSERT INTO economic_events (id, tenant_id, saas_id, type, severity, payload_json)
            VALUES (?, ?, ?, 'ECONOMICS_COMPUTE', 'info', ?)
        `).bind(
            `ee_${crypto.randomUUID()}`,
            instance.tenant_id,
            instance.id,
            JSON.stringify({ margin: marginEur, cost: totalCostEur, risk: riskLevel })
        ).run();

        return { marginEur, riskLevel, daysInTrial };

    } catch (e) {
        console.error("Economics Compute Failed", e);
    }
}

function getDaysInTrial(startDateStr: string) {
    if (!startDateStr) return 0;
    const start = new Date(startDateStr).getTime();
    const now = Date.now();
    return Math.floor((now - start) / (1000 * 3600 * 24));
}
