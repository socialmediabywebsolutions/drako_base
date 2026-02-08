import { env } from '@/lib/cf';

export interface EmpireStats {
    total_active_saas: number;
    total_trials: number;
    total_burn_rate: number;
    projected_revenue: number;
    avg_margin: number;
}

export interface PortfolioItem {
    id: string;
    tenant_id: string;
    name: string;
    slug: string;
    status: string;
    current_pack: string;
    plan_tier: string;
    days_in_trial: number;
    sentiment_score: number;
    health_score: number;
    margin: number;
    mrr: number;
    cost: number;
    risk_level: string;
    degraded_mode: boolean;
    flags: string[];
    custom_domain?: string;
    domain_status?: string;
}

export async function getEmpireOverview(): Promise<{ stats: EmpireStats, portfolio: PortfolioItem[] }> {
    const bindings = env();
    const db = bindings?.DRACO_DB;
    if (!db) throw new Error("DB Connection Failed");

    // 1. Fetch All Instances with persisted data
    const instancesResult = await db.prepare(`SELECT * FROM saas_instances ORDER BY created_at DESC`).all<any>();
    const instances = instancesResult.results || [];

    const portfolio: PortfolioItem[] = [];

    for (const inst of instances) {
        const trialStart = new Date(inst.trial_started_at).getTime();
        const now = new Date().getTime();
        const daysInTrial = Math.floor((now - trialStart) / (1000 * 3600 * 24));

        // READ PERSISTED VALUES (Populated by Cron)
        const margin = inst.margin_eur || 0;
        const mrr = inst.mrr_eur || 0;
        const cost = inst.cost_eur || 0;
        const sentiment = inst.sentiment_score || 50;
        const risk = inst.risk_level || 'low';
        const degraded = inst.degraded_mode === 1;

        // Visual Health Score (Technical/Financial)
        let health = 100;
        if (margin < 0) health -= 20;
        if (risk === 'critical') health -= 50;
        if (risk === 'high') health -= 30;
        if (sentiment < 20) health -= 20;
        if (degraded) health = Math.min(health, 40);

        portfolio.push({
            id: inst.id,
            tenant_id: inst.tenant_id,
            name: inst.name,
            slug: inst.slug,
            status: inst.status,
            current_pack: inst.current_pack || inst.plan_tier, // Fallback
            plan_tier: inst.plan_tier,
            days_in_trial: daysInTrial,
            sentiment_score: sentiment,
            health_score: Math.max(0, health),
            margin: margin,
            mrr: mrr,
            cost: cost,
            risk_level: risk,
            degraded_mode: degraded,
            degraded_mode: degraded,
            flags: inst.intervention_flags ? JSON.parse(inst.intervention_flags) : [],
            custom_domain: inst.custom_domain,
            domain_status: inst.domain_status
        });
    }

    // 2. Aggregate Stats
    const stats: EmpireStats = {
        total_active_saas: portfolio.filter(p => p.status === 'active').length,
        total_trials: portfolio.filter(p => p.status === 'trial_active').length,
        // Burn Rate: specific definition from user? "Coste mensual total" or "Negative Margin"?
        // Usually Burn Rate is "Money I am losing". So sum of negative margins.
        total_burn_rate: portfolio.reduce((acc, curr) => acc + (curr.margin < 0 ? Math.abs(curr.margin) : 0), 0),
        projected_revenue: portfolio.reduce((acc, curr) => acc + curr.mrr, 0), // Use Real MRR
        avg_margin: portfolio.reduce((acc, curr) => acc + curr.margin, 0) / (portfolio.length || 1)
    };

    return { stats, portfolio };
}

export async function archiveInstance(saasId: string, tenantId: string): Promise<void> {
    const bindings = env();
    const db = bindings?.DRACO_DB;
    if (!db) throw new Error("DB Connection Failed");

    // 1. Update SaaS Instance Status
    await db.prepare("UPDATE saas_instances SET status = 'archived' WHERE id = ? AND tenant_id = ?").bind(saasId, tenantId).run();

    // 2. Update Legacy SaaS Table
    await db.prepare("UPDATE saas SET status = 'archived' WHERE id = ? AND tenant_id = ?").bind(saasId, tenantId).run();

    // 3. Update Domains (Release them or just mark archived so logic doesn't route)
    await db.prepare("UPDATE saas_domains SET status = 'archived' WHERE saas_id = ? AND tenant_id = ?").bind(saasId, tenantId).run();
}
