import { getDb } from "@/lib/db";
import type { GrowthAnalysisResult, GrowthOpportunity, GrowthEvent } from "./types";

/**
 * Runs the Weekly Analysis Protocol for a specific Tenant.
 * - Top Converters
 * - Archetype detection
 * - Opportunity Scout (Alerts)
 */
export async function runWeeklyGrowthAnalysis(tenantId: string): Promise<GrowthAnalysisResult | null> {
    const d1 = getDb();
    if (!d1) {
        console.warn(`[GROWTH_ANALYZER] Database unavailable for tenant ${tenantId}`);
        return null;
    }

    const oneWeekAgo = Date.now() - 7 * 24 * 3600 * 1000;
    const oneWeekAgoISO = new Date(oneWeekAgo).toISOString();

    // 1. Fetch relevant data (last 7 days for fast check, 30 days for archetypes)
    // Simplified for V1: Query raw events and process in memory (careful with scale)
    // At scale, this should use SQL aggregations.

    // Get recent conversions
    const { results: conversions } = await d1.prepare(`
    SELECT * FROM saas_growth_events 
    WHERE tenant_id = ? 
    AND event_name = 'mentoria.converted'
    AND created_at > date('now', '-7 days')
  `).bind(tenantId).all<GrowthEvent>();

    // Get recent signups for funnel
    const { results: signups } = await d1.prepare(`
    SELECT * FROM saas_growth_events
    WHERE tenant_id = ?
    AND event_name = 'mentoria.signup'
    AND created_at > date('now', '-7 days')
  `).bind(tenantId).all<GrowthEvent>();

    // --- Insight 1: Top Converters (Sticky Subjects) ---
    const subjectCounts: Record<string, number> = {};
    conversions.forEach(c => {
        const p = parsePayload(c.payload);
        if (p.materia_principal) {
            subjectCounts[p.materia_principal] = (subjectCounts[p.materia_principal] || 0) + 1;
        }
    });

    const sortedSubjects = Object.entries(subjectCounts)
        .sort(([, a], [, b]) => b - a)
        .slice(0, 3)
        .map(([k]) => k);

    // --- Insight 2: Archetypes (Loyal vs Churn Risk) ---
    // Heuristic: "Loyal" if > 2 conversions (re-subs) or high engagement
    // For V1, we simulate "Loyal" as "Fast Converter + High Agente Usage"
    // "Churn Risk" as "High Latency + Low Agente Usage"

    // Placeholder logic for V1
    const loyalFeatures = ["Usa Visuales", "Edad 12-15"];
    const churnFeatures = ["Solo Texto", "Sin Interacción Padres"];

    // --- Insight 3: Opportunity Scout ---
    const opportunities: GrowthOpportunity[] = [];

    // A. Viral Geo (> 20% viral source in a country)
    const countryViralStats: Record<string, { total: number, viral: number }> = {};
    signups.forEach(s => {
        if (!countryViralStats[s.country]) countryViralStats[s.country] = { total: 0, viral: 0 };
        countryViralStats[s.country].total++;
        if (s.conversion_source === 'viral_24h' || s.conversion_source === 'referral') {
            countryViralStats[s.country].viral++;
        }
    });

    Object.entries(countryViralStats).forEach(([country, stats]) => {
        if (stats.total > 5) { // Min sample
            const viralRate = stats.viral / stats.total;
            if (viralRate > 0.20) { // +20% Threshold
                opportunities.push({
                    id: `VIRAL_GEO_${country}`,
                    type: 'VIRAL_GEO',
                    description: `Viralidad en ${country} supera el 20% (${(viralRate * 100).toFixed(0)}%)`,
                    recommendation: `Potenciar campañas de referidos en ${country}.`,
                    confidence_score: 0.8
                });
            }
        }
    });

    // B. Pattern Repeated (Fast Converters > 5 identical patterns)
    // Check for common Age + Subject in Fast Converters
    const fastPatterns: Record<string, number> = {};
    conversions.forEach(c => {
        if (c.is_fast_converter) {
            const p = parsePayload(c.payload);
            const key = `${p.edad_alumno}_${p.materia_principal}`;
            fastPatterns[key] = (fastPatterns[key] || 0) + 1;
        }
    });

    Object.entries(fastPatterns).forEach(([key, count]) => {
        if (count >= 5) {
            const [age, subject] = key.split('_');
            opportunities.push({
                id: `FAST_PATTERN_${key}`,
                type: 'PATTERN_REPEATED',
                description: `Patrón repetido: Alumnos de ${age} años en ${subject} convierten rápido.`,
                recommendation: `Crear pack específico para ${subject} edad ${age}.`,
                confidence_score: 0.9
            });
        }
    });

    return {
        top_converters: {
            winning_messages: ["(Simulated) Texto A"], // Requires deeper analyzing of text payload
            sticky_subjects: sortedSubjects
        },
        archetypes: {
            loyal: loyalFeatures,
            churn_risk: churnFeatures
        },
        opportunities
    };
}

function parsePayload(payload: any): any {
    if (typeof payload === 'string') {
        try {
            return JSON.parse(payload);
        } catch {
            return {};
        }
    }
    return payload || {};
}
