import { queryOne, run } from "@/lib/db";

export interface HealthFactor {
    name: string;
    score: number; // 0-100
    weight: number; // suma = 1.0
    description: string;
}

export interface HealthScoreResult {
    overallScore: number;
    factors: HealthFactor[];
    status: "healthy" | "warning" | "critical";
    recommendation: string;
    metrics: {
        mrr: number;
        mrrGrowthRate: number;
        customerCount: number;
        churnRate: number;
        avgResponseTimeHours: number;
        uptimePercentage: number;
    };
}

interface ChurnData {
    churned_last_30d: number;
    total_start_30d: number;
}

/**
 * Calcula health score completo para un SaaS
 */
export async function calculateHealthScore(params: {
    saasId: string;
    tenantId: string;
}): Promise<HealthScoreResult> {
    const { saasId, tenantId } = params;

    // 1. Revenue metrics
    const revenueScore = await calculateRevenueScore(saasId, tenantId);

    // 2. Customer retention
    const retentionScore = await calculateRetentionScore(saasId, tenantId);

    // 3. Technical health
    const technicalScore = await calculateTechnicalScore(saasId, tenantId);

    // 4. Feature utilization
    const utilizationScore = await calculateFeatureUtilizationScore(saasId, tenantId);

    // 5. Support quality
    const supportScore = await calculateSupportScore(saasId, tenantId);

    const factors: HealthFactor[] = [
        {
            name: "Revenue Growth",
            score: revenueScore.score,
            weight: 0.3,
            description: revenueScore.description,
        },
        {
            name: "Customer Retention",
            score: retentionScore.score,
            weight: 0.25,
            description: retentionScore.description,
        },
        {
            name: "Technical Health",
            score: technicalScore.score,
            weight: 0.15,
            description: technicalScore.description,
        },
        {
            name: "Feature Utilization",
            score: utilizationScore.score,
            weight: 0.15,
            description: utilizationScore.description,
        },
        {
            name: "Support Quality",
            score: supportScore.score,
            weight: 0.15,
            description: supportScore.description,
        },
    ];

    const overallScore = Math.round(
        factors.reduce((acc, factor) => acc + factor.score * factor.weight, 0),
    );

    const status = overallScore >= 70 ? "healthy" : overallScore >= 40 ? "warning" : "critical";

    const recommendation = generateRecommendation(overallScore, factors);

    return {
        overallScore,
        factors,
        status,
        recommendation,
        metrics: {
            mrr: revenueScore.mrr,
            mrrGrowthRate: revenueScore.growthRate,
            customerCount: retentionScore.customerCount,
            churnRate: retentionScore.churnRate,
            avgResponseTimeHours: supportScore.avgResponseTime,
            uptimePercentage: technicalScore.uptime,
        },
    };
}

async function calculateRevenueScore(
    saasId: string,
    tenantId: string,
): Promise<{ score: number; description: string; mrr: number; growthRate: number }> {
    // Get current MRR from active subscriptions
    const current = await queryOne<{ mrr: number }>(
        `SELECT COALESCE(SUM(amount), 0) / 100.0 as mrr
     FROM stripe_mapping
     WHERE saas_id = ? AND tenant_id = ? AND status = 'active'`,
        saasId,
        tenantId,
    );

    const currentMrr = current?.mrr ?? 0;

    // Get MRR from 30 days ago
    const previous = await queryOne<{ mrr: number }>(
        `SELECT COALESCE(SUM(amount), 0) / 100.0 as mrr
     FROM stripe_mapping
     WHERE saas_id = ? AND tenant_id = ? 
     AND status = 'active'
     AND created_at <= datetime('now', '-30 days')`,
        saasId,
        tenantId,
    );

    const previousMrr = previous?.mrr ?? 0;

    // Calculate growth rate
    const growthRate = previousMrr > 0 ? ((currentMrr - previousMrr) / previousMrr) * 100 : 0;

    // Score based on growth rate
    let score = 50; // baseline
    if (growthRate > 20) score = 100;
    else if (growthRate > 10) score = 85;
    else if (growthRate > 5) score = 70;
    else if (growthRate > 0) score = 60;
    else if (growthRate > -5) score = 40;
    else if (growthRate > -10) score = 25;
    else score = 10;

    const description =
        growthRate > 10
            ? `Strong growth: +${growthRate.toFixed(1)}%`
            : growthRate > 0
                ? `Positive growth: +${growthRate.toFixed(1)}%`
                : growthRate === 0
                    ? "Stagnant revenue"
                    : `Declining: ${growthRate.toFixed(1)}%`;

    return { score, description, mrr: currentMrr, growthRate };
}

async function calculateRetentionScore(
    saasId: string,
    tenantId: string,
): Promise<{ score: number; description: string; customerCount: number; churnRate: number }> {
    // Get customer count
    const customers = await queryOne<{ count: number }>(
        `SELECT COUNT(*) as count
     FROM saas_customers
     WHERE saas_id = ? AND tenant_id = ? AND status = 'active'`,
        saasId,
        tenantId,
    );

    const customerCount = customers?.count ?? 0;

    // Calculate churn rate (last 30 days)
    const churnData = await queryOne<ChurnData>(
        `SELECT 
      COUNT(CASE WHEN status = 'churned' AND updated_at > datetime('now', '-30 days') THEN 1 END) as churned_last_30d,
      COUNT(CASE WHEN created_at <= datetime('now', '-30 days') THEN 1 END) as total_start_30d
     FROM saas_customers
     WHERE saas_id = ? AND tenant_id = ?`,
        saasId,
        tenantId,
    );

    const churnRate =
        churnData && churnData.total_start_30d > 0
            ? (churnData.churned_last_30d / churnData.total_start_30d) * 100
            : 0;

    // Score based on churn rate (lower is better)
    let score = 50;
    if (churnRate < 2) score = 100;
    else if (churnRate < 5) score = 85;
    else if (churnRate < 8) score = 70;
    else if (churnRate < 12) score = 50;
    else if (churnRate < 20) score = 30;
    else score = 10;

    const description =
        churnRate < 5
            ? `Excellent retention: ${churnRate.toFixed(1)}% churn`
            : churnRate < 10
                ? `Good retention: ${churnRate.toFixed(1)}% churn`
                : `High churn: ${churnRate.toFixed(1)}%`;

    return { score, description, customerCount, churnRate };
}

async function calculateTechnicalScore(
    saasId: string,
    tenantId: string,
): Promise<{ score: number; description: string; uptime: number }> {
    // For now, assume 99.9% uptime (can integrate with monitoring later)
    const uptime = 99.9;

    // Check for recent errors or issues
    const errors = await queryOne<{ count: number }>(
        `SELECT COUNT(*) as count
     FROM campamento_events
     WHERE saas_id = ? AND tenant_id = ? 
     AND severity IN ('ERROR', 'CRITICAL')
     AND created_at > datetime('now', '-24 hours')`,
        saasId,
        tenantId,
    );

    const errorCount = errors?.count ?? 0;

    let score = 90; // baseline for good uptime
    if (errorCount > 100) score = 30;
    else if (errorCount > 50) score = 50;
    else if (errorCount > 20) score = 70;
    else if (errorCount > 5) score = 85;

    const description =
        errorCount === 0
            ? "No errors (24h)"
            : errorCount < 10
                ? `Low error rate: ${errorCount} errors`
                : `High error rate: ${errorCount} errors`;

    return { score, description, uptime };
}

async function calculateFeatureUtilizationScore(
    saasId: string,
    tenantId: string,
): Promise<{ score: number; description: string }> {
    // Get enabled features for this SaaS
    const entitlements = await queryOne<{ features_json: string }>(
        `SELECT features_json
     FROM project_entitlements
     WHERE project_id = ? AND tenant_id = ?`,
        saasId,
        tenantId,
    );

    if (!entitlements) {
        return { score: 50, description: "No entitlements configured" };
    }

    const enabledFeatures = JSON.parse(entitlements.features_json || "[]") as string[];
    const featureCount = enabledFeatures.length;

    // Simple scoring: more features enabled = better utilization
    let score = 50;
    if (featureCount >= 10) score = 100;
    else if (featureCount >= 7) score = 80;
    else if (featureCount >= 5) score = 65;
    else if (featureCount >= 3) score = 50;
    else score = 30;

    const description = `${featureCount} features enabled`;

    return { score, description };
}

async function calculateSupportScore(
    saasId: string,
    tenantId: string,
): Promise<{ score: number; description: string; avgResponseTime: number }> {
    // Get average response time for tickets/messages
    const responseTime = await queryOne<{ avg_hours: number }>(
        `SELECT AVG(
      (julianday(first_response_at) - julianday(created_at)) * 24
    ) as avg_hours
    FROM inbox_messages
    WHERE saas_id = ? AND tenant_id = ?
    AND first_response_at IS NOT NULL
    AND created_at > datetime('now', '-30 days')`,
        saasId,
        tenantId,
    );

    const avgResponseTime = responseTime?.avg_hours ?? 24;

    // Score based on response time (lower is better)
    let score = 50;
    if (avgResponseTime < 1) score = 100;
    else if (avgResponseTime < 4) score = 85;
    else if (avgResponseTime < 12) score = 70;
    else if (avgResponseTime < 24) score = 50;
    else if (avgResponseTime < 48) score = 30;
    else score = 10;

    const description =
        avgResponseTime < 4
            ? `Fast response: ${avgResponseTime.toFixed(1)}h avg`
            : avgResponseTime < 24
                ? `Moderate response: ${avgResponseTime.toFixed(1)}h avg`
                : `Slow response: ${avgResponseTime.toFixed(1)}h avg`;

    return { score, description, avgResponseTime };
}

function generateRecommendation(overallScore: number, factors: HealthFactor[]): string {
    if (overallScore >= 80) {
        return "Excellent health! Consider scaling marketing and sales efforts.";
    }

    if (overallScore >= 70) {
        return "Healthy SaaS. Monitor metrics and maintain current trajectory.";
    }

    // Find weakest factor
    const weakest = factors.reduce((min, factor) => (factor.score < min.score ? factor : min));

    if (overallScore >= 40) {
        return `Needs attention. Focus on improving ${weakest.name.toLowerCase()}.`;
    }

    return `Critical status. Immediate action required on ${weakest.name.toLowerCase()}. Consider pivot or sunset.`;
}

/**
 * Persiste el health score en la BD
 */
export async function saveHealthScore(params: {
    saasId: string;
    tenantId: string;
    result: HealthScoreResult;
}): Promise<void> {
    const { saasId, tenantId, result } = params;
    const id = globalThis.crypto?.randomUUID?.() ?? `health_${Date.now()}`;

    await run(
        `INSERT INTO saas_health_metrics (
      id, tenant_id, saas_id,
      overall_score, revenue_score, retention_score,
      technical_score, feature_utilization_score, support_score,
      mrr, mrr_growth_rate, customer_count, churn_rate,
      avg_response_time_hours, uptime_percentage,
      health_status, recommendation, calculated_at
    ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`,
        id,
        tenantId,
        saasId,
        result.overallScore,
        result.factors[0].score,
        result.factors[1].score,
        result.factors[2].score,
        result.factors[3].score,
        result.factors[4].score,
        result.metrics.mrr,
        result.metrics.mrrGrowthRate,
        result.metrics.customerCount,
        result.metrics.churnRate,
        result.metrics.avgResponseTimeHours,
        result.metrics.uptimePercentage,
        result.status,
        result.recommendation,
        new Date().toISOString(),
    );
}

/**
 * Obtiene el último health score de un SaaS
 */
export async function getLatestHealthScore(params: {
    saasId: string;
    tenantId: string;
}): Promise<HealthScoreResult | null> {
    const row = await queryOne<{
        overall_score: number;
        revenue_score: number;
        retention_score: number;
        technical_score: number;
        feature_utilization_score: number;
        support_score: number;
        health_status: "healthy" | "warning" | "critical";
        recommendation: string;
        mrr: number;
        mrr_growth_rate: number;
        customer_count: number;
        churn_rate: number;
        avg_response_time_hours: number;
        uptime_percentage: number;
    }>(
        `SELECT * FROM saas_health_metrics
     WHERE saas_id = ? AND tenant_id = ?
     ORDER BY calculated_at DESC
     LIMIT 1`,
        params.saasId,
        params.tenantId,
    );

    if (!row) return null;

    return {
        overallScore: row.overall_score,
        status: row.health_status,
        recommendation: row.recommendation,
        factors: [
            { name: "Revenue Growth", score: row.revenue_score, weight: 0.3, description: "" },
            { name: "Customer Retention", score: row.retention_score, weight: 0.25, description: "" },
            { name: "Technical Health", score: row.technical_score, weight: 0.15, description: "" },
            {
                name: "Feature Utilization",
                score: row.feature_utilization_score,
                weight: 0.15,
                description: "",
            },
            { name: "Support Quality", score: row.support_score, weight: 0.15, description: "" },
        ],
        metrics: {
            mrr: row.mrr,
            mrrGrowthRate: row.mrr_growth_rate,
            customerCount: row.customer_count,
            churnRate: row.churn_rate,
            avgResponseTimeHours: row.avg_response_time_hours,
            uptimePercentage: row.uptime_percentage,
        },
    };
}
