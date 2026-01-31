import { createSaasFromBlueprint } from "./saas-factory-orchestrator";
import type { SaasBlueprintDraft, SaasVerticalId } from "./saas-factory-types";
import { run } from "@/lib/db";

const COUNTRIES = [
    { code: "ES", name: "España", currency: "EUR", price: 10, educationalContext: "EBAU / Selectividad" },
    { code: "MX", name: "México", currency: "MXN", price: 200, educationalContext: "EXANI-II / SEP" },
    { code: "CO", name: "Colombia", currency: "COP", price: 45000, educationalContext: "Saber 11 (ICFES)" },
    { code: "AR", name: "Argentina", currency: "ARS", price: 10000, educationalContext: "CBC / UBA" },
    { code: "CL", name: "Chile", currency: "CLP", price: 10000, educationalContext: "PAES / Mineduc" },
];

export async function orchestrateGlobalExpansion(ownerTenantId: string) {
    const results = [];

    for (const country of COUNTRIES) {
        const slug = `mentoria-${country.code.toLowerCase()}`;
        const blueprint: SaasBlueprintDraft = {
            ownerTenantId,
            saasName: `MentorIA Escolar - ${country.name}`,
            proposedSlug: slug,
            proposedSubdomain: slug,
            verticalId: "EDUCATION" as SaasVerticalId,
            summary: `Plataforma educativa MentorIA enfocada en el mercado de ${country.name}.`,
            targetAudience: `Estudiantes y padres en ${country.name}.`,
            mainProblem: "Falta de apoyo personalizado y accesible.",
            mainGoal: "Brindar tutoría, apoyo emocional y orientación vocacional.",
            packsByDepartment: {
                marketing: "BASIC",
                accounting: "BASIC",
                support: "BASIC",
            },
            initialPricing: {
                currentMonthlyPrice: country.price,
            },
            aiProfile: {
                tier: "BALANCED",
            },
            provisioning: {
                domains: {
                    primarySubdomain: slug,
                    primaryDomainType: "SUBDOMAIN_ONLY",
                },
                stripe: {
                    billingInterval: "MONTHLY",
                    taxProfile: country.code === "ES" ? "ES_AUTONOMO" : "OTHER",
                    currency: country.currency,
                },
                ai: {
                    tier: "BALANCED",
                },
            },
        };

        console.log(`[ORCHESTRATOR] Launching ${country.name}...`);
        const { saasId } = await createSaasFromBlueprint({ ownerTenantId, blueprint });

        // 4. Inject Localized Prompts (Mock logic - in real scenario, we'd fetch from mentoria-global-prompts.v1.md)
        // Here we would use a dedicated service to update saas_agents config

        // 5. Activate Connectors (WhatsApp)
        await run(
            "INSERT INTO connectors (id, tenant_id, saas_id, type, status, config) VALUES (?, ?, ?, ?, ?, ?)",
            `wa_${saasId}`,
            ownerTenantId,
            saasId,
            "whatsapp",
            "active",
            JSON.stringify({ mode: "lead+emotional", phone: `local_number_${country.code}` })
        );

        // 6. Monitoring (Growth Autopilot)
        await run(
            "INSERT INTO autopilot_subscriptions (id, saas_id, type, status) VALUES (?, ?, ?, ?)",
            `growth_${saasId}`,
            saasId,
            "growth",
            "active"
        );

        results.push({ country: country.name, saasId, domain: `${slug}.drako.systems` });
    }

    return results;
}
