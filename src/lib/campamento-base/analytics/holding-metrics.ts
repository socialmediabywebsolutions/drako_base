import { queryOne, queryAll, run } from "@/lib/db";

export interface HoldingMetrics {
    financial: {
        mrr: number;
        arr: number;
        churnRate: number;
        ltv: number;
        cac: number;
        mrrGrowthRate: number;
    };
    operational: {
        activeSaas: number;
        totalCustomers: number;
        activeSubscriptions: number;
        totalProjects: number;
        customerGrowthRate: number;
        newSaasThisMonth: number;
    };
    technical: {
        apiRequests: number;
        aiTokensUsed: number;
        d1Queries: number;
        avgEdgeDuration: number;
    };
    saasList: SaasBreakdown[];
}

export interface SaasBreakdown {
    saasId: string;
    name: string;
    slug: string;
    vertical: string;
    mrr: number;
    customers: number;
    subscriptions: number;
    healthScore: number;
    healthStatus: "healthy" | "warning" | "critical";
    trend: "up" | "down" | "stable";
}

/**
 * Calcula métricas consolidadas del holding
 */
export async function calculateHoldingMetrics(tenantId: string): Promise<HoldingMetrics> {
    // 1. Financial metrics (from Stripe mapping)
    const financial = await queryOne<{
        total_mrr: number;
        total_subscriptions: number;
    }>(
        `SELECT 
      COALESCE(SUM(amount), 0) / 100.0 as total_mrr,
      COUNT(*) as total_subscriptions
     FROM stripe_mapping
     WHERE tenant_id = ? AND status = 'active'`,
        tenantId,
    );

    const totalMrr = financial?.total_mrr ?? 0;
    const totalArr = totalMrr * 12;

    // Get MRR from 30 days ago for growth rate
    const previousFinancial = await queryOne<{ total_mrr: number }>(
        `SELECT COALESCE(SUM(amount), 0) / 100.0 as total_mrr
     FROM stripe_mapping
     WHERE tenant_id = ? 
     AND status = 'active'
     AND created_at <= datetime('now', '-30 days')`,
        tenantId,
    );

    const previousMrr = previousFinancial?.total_mrr ?? 0;
    const mrrGrowthRate = previousMrr > 0 ? ((totalMrr - previousMrr) / previousMrr) * 100 : 0;

    // 2. Calculate aggregate churn rate
    const churnData = await queryOne<{ churned: number; total: number }>(
        `SELECT 
      COUNT(CASE WHEN status = 'churned' AND updated_at > datetime('now', '-30 days') THEN 1 END) as churned,
      COUNT(CASE WHEN created_at <= datetime('now', '-30 days') THEN 1 END) as total
     FROM saas_customers
     WHERE tenant_id = ?`,
        tenantId,
    );

    const avgChurnRate = churnData && churnData.total > 0 ? (churnData.churned / churnData.total) * 100 : 0;

    // 3. Operational metrics
    const operational = await queryOne<{
        active_saas: number;
        total_customers: number;
        total_projects: number;
    }>(
        `SELECT 
      COUNT(DISTINCT p.id) as active_saas,
      COUNT(DISTINCT c.id) as total_customers,
      COUNT(DISTINCT proj.id) as total_projects
     FROM saas_projects p
     LEFT JOIN saas_customers c ON c.saas_id = p.id AND c.status = 'active'
     LEFT JOIN projects proj ON proj.saas_id = p.id
     WHERE p.tenant_id = ? AND p.status = 'active'`,
        tenantId,
    );

    const activeSaas = operational?.active_saas ?? 0;
    const totalCustomers = operational?.total_customers ?? 0;
    const totalProjects = operational?.total_projects ?? 0;

    // Calculate customer growth rate
    const previousCustomers = await queryOne<{ count: number }>(
        `SELECT COUNT(*) as count
     FROM saas_customers
     WHERE tenant_id = ?
     AND created_at <= datetime('now', '-30 days')
     AND status = 'active'`,
        tenantId,
    );

    const prevCount = previousCustomers?.count ?? 0;
    const customerGrowthRate = prevCount > 0 ? ((totalCustomers - prevCount) / prevCount) * 100 : 0;

    // New SaaS this month
    const newSaasThisMonth = await queryOne<{ count: number }>(
        `SELECT COUNT(*) as count
     FROM saas_projects
     WHERE tenant_id = ?
     AND created_at >= datetime('now', 'start of month')`,
        tenantId,
    );

    // 4. Technical metrics (placeholder - would integrate with actual monitoring)
    const technical = {
        apiRequests: 0, // TODO: integrate with analytics
        aiTokensUsed: 0, // TODO: integrate with AI usage tracking
        d1Queries: 0, // TODO: integrate with D1 analytics
        avgEdgeDuration: 0, // TODO: integrate with Workers analytics
    };

    // 5. Per-SaaS breakdown
    const saasBreakdown = await queryAll<{
        saas_id: string;
        saas_name: string;
        saas_slug: string;
        vertical: string;
        mrr: number;
        active_customers: number;
        active_subscriptions: number;
        health_score: number;
        health_status: "healthy" | "warning" | "critical";
    }>(
        `SELECT 
      p.id as saas_id,
      p.name as saas_name,
      p.slug as saas_slug,
      p.vertical,
      COALESCE(m.mrr, 0) as mrr,
      COALESCE(m.active_customers, 0) as active_customers,
      COALESCE(m.active_subscriptions, 0) as active_subscriptions,
      COALESCE(h.overall_score, 50) as health_score,
      COALESCE(h.health_status, 'warning') as health_status
     FROM saas_projects p
     LEFT JOIN v_saas_performance m ON m.saas_id = p.id
     LEFT JOIN (
       SELECT saas_id, overall_score, health_status
       FROM saas_health_metrics
       WHERE id IN (
         SELECT id FROM saas_health_metrics h2
         WHERE h2.saas_id = saas_health_metrics.saas_id
         ORDER BY calculated_at DESC
         LIMIT 1
       )
     ) h ON h.saas_id = p.id
     WHERE p.tenant_id = ? AND p.status = 'active'
     ORDER BY mrr DESC`,
        tenantId,
    );

    const saasList: SaasBreakdown[] = saasBreakdown.map((saas) => ({
        saasId: saas.saas_id,
        name: saas.saas_name,
        slug: saas.saas_slug,
        vertical: saas.vertical,
        mrr: saas.mrr,
        customers: saas.active_customers,
        subscriptions: saas.active_subscriptions,
        healthScore: saas.health_score,
        healthStatus: saas.health_status,
        trend: "stable" as const, // TODO: calculate from historical data
    }));

    return {
        financial: {
            mrr: totalMrr,
            arr: totalArr,
            churnRate: avgChurnRate,
            ltv: 0, // TODO: calculate LTV
            cac: 0, // TODO: calculate CAC
            mrrGrowthRate,
        },
        operational: {
            activeSaas,
            totalCustomers,
            activeSubscriptions: financial?.total_subscriptions ?? 0,
            totalProjects,
            customerGrowthRate,
            newSaasThisMonth: newSaasThisMonth?.count ?? 0,
        },
        technical,
        saasList,
    };
}

/**
 * Guarda snapshot de métricas del holding
 */
export async function saveHoldingSnapshot(params: {
    tenantId: string;
    metrics: HoldingMetrics;
    snapshotType?: "daily" | "weekly" | "monthly";
}): Promise<void> {
    const { tenantId, metrics, snapshotType = "daily" } = params;
    const id = globalThis.crypto?.randomUUID?.() ?? `snapshot_${Date.now()}`;
    const now = new Date().toISOString();

    await run(
        `INSERT INTO holding_metrics_snapshots (
      id, tenant_id, snapshot_date, snapshot_type,
      total_mrr, total_arr, avg_churn_rate,
      active_saas_count, total_customers, total_active_subscriptions, total_projects,
      total_api_requests, total_ai_tokens, total_d1_queries, avg_edge_duration_ms,
      mrr_growth_rate, customer_growth_rate, new_saas_this_month,
      saas_breakdown_json, created_at
    ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`,
        id,
        tenantId,
        now,
        snapshotType,
        metrics.financial.mrr,
        metrics.financial.arr,
        metrics.financial.churnRate,
        metrics.operational.activeSaas,
        metrics.operational.totalCustomers,
        metrics.operational.activeSubscriptions,
        metrics.operational.totalProjects,
        metrics.technical.apiRequests,
        metrics.technical.aiTokensUsed,
        metrics.technical.d1Queries,
        metrics.technical.avgEdgeDuration,
        metrics.financial.mrrGrowthRate,
        metrics.operational.customerGrowthRate,
        metrics.operational.newSaasThisMonth,
        JSON.stringify(metrics.saasList),
        now,
    );
}

/**
 * Obtiene el último snapshot de métricas
 */
export async function getLatestHoldingMetrics(tenantId: string): Promise<HoldingMetrics | null> {
    const row = await queryOne<{
        total_mrr: number;
        total_arr: number;
        avg_churn_rate: number;
        active_saas_count: number;
        total_customers: number;
        total_active_subscriptions: number;
        total_projects: number;
        total_api_requests: number;
        total_ai_tokens: number;
        total_d1_queries: number;
        avg_edge_duration_ms: number;
        mrr_growth_rate: number;
        customer_growth_rate: number;
        new_saas_this_month: number;
        saas_breakdown_json: string;
    }>(
        `SELECT * FROM holding_metrics_snapshots
     WHERE tenant_id = ?
     ORDER BY snapshot_date DESC
     LIMIT 1`,
        tenantId,
    );

    if (!row) return null;

    return {
        financial: {
            mrr: row.total_mrr,
            arr: row.total_arr,
            churnRate: row.avg_churn_rate,
            ltv: 0,
            cac: 0,
            mrrGrowthRate: row.mrr_growth_rate,
        },
        operational: {
            activeSaas: row.active_saas_count,
            totalCustomers: row.total_customers,
            activeSubscriptions: row.total_active_subscriptions,
            totalProjects: row.total_projects,
            customerGrowthRate: row.customer_growth_rate,
            newSaasThisMonth: row.new_saas_this_month,
        },
        technical: {
            apiRequests: row.total_api_requests,
            aiTokensUsed: row.total_ai_tokens,
            d1Queries: row.total_d1_queries,
            avgEdgeDuration: row.avg_edge_duration_ms,
        },
        saasList: JSON.parse(row.saas_breakdown_json || "[]"),
    };
}

/**
 * Obtiene histórico de métricas para charts
 */
export async function getHoldingMetricsHistory(params: {
    tenantId: string;
    days?: number;
}): Promise<Array<{ date: string; mrr: number; customers: number; activeSaas: number }>> {
    const { tenantId, days = 30 } = params;

    const rows = await queryAll<{
        snapshot_date: string;
        total_mrr: number;
        total_customers: number;
        active_saas_count: number;
    }>(
        `SELECT snapshot_date, total_mrr, total_customers, active_saas_count
     FROM holding_metrics_snapshots
     WHERE tenant_id = ?
     AND snapshot_type = 'daily'
     AND snapshot_date >= datetime('now', '-${days} days')
     ORDER BY snapshot_date ASC`,
        tenantId,
    );

    return rows.map((row) => ({
        date: row.snapshot_date,
        mrr: row.total_mrr,
        customers: row.total_customers,
        activeSaas: row.active_saas_count,
    }));
}
