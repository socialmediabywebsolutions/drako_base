import { queryOne, run } from "@/lib/db";

export interface BusinessIntelligence {
    tenantId: string;
    companyId: string;
    socialProfiles: {
        facebook?: string;
        instagram?: string;
        linkedin?: string;
    };
    location: {
        address: string;
    };
    operatingCosts: {
        rent: number;
        electricity: number;
        water: number;
        gas: number;
        labor: number;
        other: number;
    };
    fiscalInfo: {
        taxId: string;
        address: string;
    };
}

/**
 * Guarda o actualiza la base de conocimiento del cliente (soporta actualizaciones parciales)
 */
export async function saveBusinessKnowledge(kb: Partial<BusinessIntelligence> & { tenantId: string; companyId: string }) {
    const id = `${kb.tenantId}:${kb.companyId}`;

    // Primero nos aseguramos de que el registro exista
    await run(
        "INSERT OR IGNORE INTO company_business_intelligence (id, tenant_id, company_id) VALUES (?, ?, ?)",
        id, kb.tenantId, kb.companyId
    );

    const updates: string[] = [];
    const params: unknown[] = [];

    if (kb.socialProfiles) {
        updates.push("social_profiles_json = ?");
        params.push(JSON.stringify(kb.socialProfiles));
    }
    if (kb.location?.address) {
        updates.push("physical_address = ?");
        params.push(kb.location.address);
    }
    if (kb.operatingCosts) {
        if (kb.operatingCosts.rent !== undefined) { updates.push("rent_mortgage = ?"); params.push(kb.operatingCosts.rent); }
        if (kb.operatingCosts.electricity !== undefined) { updates.push("electricity = ?"); params.push(kb.operatingCosts.electricity); }
        if (kb.operatingCosts.water !== undefined) { updates.push("water = ?"); params.push(kb.operatingCosts.water); }
        if (kb.operatingCosts.gas !== undefined) { updates.push("gas = ?"); params.push(kb.operatingCosts.gas); }
        if (kb.operatingCosts.labor !== undefined) { updates.push("labor_costs = ?"); params.push(kb.operatingCosts.labor); }
        if (kb.operatingCosts.other !== undefined) { updates.push("other_expenses = ?"); params.push(kb.operatingCosts.other); }
    }
    if (kb.fiscalInfo) {
        if (kb.fiscalInfo.taxId) { updates.push("tax_id = ?"); params.push(kb.fiscalInfo.taxId); }
        if (kb.fiscalInfo.address) { updates.push("fiscal_address = ?"); params.push(kb.fiscalInfo.address); }
    }

    if (updates.length > 0) {
        updates.push("updated_at = CURRENT_TIMESTAMP");
        const sql = `UPDATE company_business_intelligence SET ${updates.join(", ")} WHERE id = ?`;
        params.push(id);
        await run(sql, ...params);
    }
}

/**
 * Mock de análisis de situación basado en la data recolectada
 */
export async function generateSituationalAnalysis(tenantId: string, companyId: string) {
    const id = `${tenantId}:${companyId}`;
    const kb = await queryOne<{ id: string; tenant_id: string }>(
        "SELECT * FROM company_business_intelligence WHERE id = ?", id
    );

    if (!kb) throw new Error("Base de conocimiento no encontrada");

    // Aquí iría la llamada a Workers AI para generar el análisis real
    // Por ahora simulamos un análisis estructurado
    const analysis = {
        marketStatus: "Crecimiento moderado en la zona",
        competitorInsights: "Alta densidad de competidores en un radio de 2km. Diferenciación baja.",
        efficiencyOpportunities: [
            "Optimización de gastos energéticos detectada",
            "Suscripción SaaS para automatización de citas reduciría labor al 15%"
        ],
        proposal: {
            budget: 1200,
            subscriptionMonthly: 99,
            keyFeatures: ["Custom Dashboard", "Auto-Social Poster", "Stripe Checkout"]
        }
    };

    // Guardar análisis en DB
    await run(
        "UPDATE company_business_intelligence SET drako_proposal_json = ? WHERE id = ?",
        JSON.stringify(analysis), id
    );

    return analysis;
}
