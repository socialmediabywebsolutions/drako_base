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
 * Guarda o actualiza la base de conocimiento del cliente
 */
export async function saveBusinessKnowledge(kb: BusinessIntelligence) {
    const sql = `
        INSERT INTO company_business_intelligence (
            id, tenant_id, company_id, 
            social_profiles_json,
            physical_address,
            rent_mortgage, electricity, water, gas, labor_costs, other_expenses,
            tax_id, fiscal_address,
            updated_at
        ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, CURRENT_TIMESTAMP)
        ON CONFLICT(id) DO UPDATE SET
            social_profiles_json = excluded.social_profiles_json,
            physical_address = excluded.physical_address,
            rent_mortgage = excluded.rent_mortgage,
            electricity = excluded.electricity,
            water = excluded.water,
            gas = excluded.gas,
            labor_costs = excluded.labor_costs,
            other_expenses = excluded.other_expenses,
            tax_id = excluded.tax_id,
            fiscal_address = excluded.fiscal_address,
            updated_at = CURRENT_TIMESTAMP
    `;

    const id = `${kb.tenantId}:${kb.companyId}`;

    await run(sql,
        id, kb.tenantId, kb.companyId,
        JSON.stringify(kb.socialProfiles),
        kb.location.address,
        kb.operatingCosts.rent, kb.operatingCosts.electricity, kb.operatingCosts.water,
        kb.operatingCosts.gas, kb.operatingCosts.labor, kb.operatingCosts.other,
        kb.fiscalInfo.taxId, kb.fiscalInfo.address
    );
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
