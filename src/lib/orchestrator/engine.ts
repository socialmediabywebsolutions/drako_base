import { env } from "@/lib/cf";
import type { StrategicDossier } from "./types";
import { discoverCompetitors } from "./competitors";

/**
 * Runs the Strategic Analysis using Cloudflare Workers AI (Llama 3).
 * Returns the partial 'analysis_data' object.
 */
export async function runOrchestratorAnalysis(dossier: StrategicDossier): Promise<Partial<StrategicDossier['analysis_data']>> {
    const bindings = env();
    if (!bindings?.AI) {
        throw new Error("AI binding missing");
    }

    // 1. Calculate Basis for Web Score (Deterministic)
    // Logic: +40 for Website, +40 for Maps, +5 per Social (max 20)
    let score = 0;
    if (dossier.form_data.digital.web) score += 40;
    // Basic validation of Maps URL
    const mapsValue = dossier.form_data.digital.maps ?? "";
    const normalizedMapsValue = mapsValue.trim().toLowerCase();
    const hasMaps =
        normalizedMapsValue.length > 0 &&
        (
            normalizedMapsValue.includes("google.com/maps") ||
            normalizedMapsValue.includes("goo.gl/maps") ||
            normalizedMapsValue.includes("g.page") ||
            normalizedMapsValue.includes("maps.app.goo.gl")
        );
    if (hasMaps) score += 40;

    const socials = [
        dossier.form_data.digital.instagram,
        dossier.form_data.digital.facebook,
        dossier.form_data.digital.linkedin,
        dossier.form_data.digital.tiktok
    ];
    const socialCount = socials.filter(s => s && s.length > 5).length;
    score += Math.min(20, socialCount * 5);

    // 2. AI Analysis (SWOT + Strategy)
    const systemPrompt = `You are Drako, an expert Business Strategy Consultant for SaaS and Service businesses.
  Analyze the provided business data and generate a JSON response with:
  - swot: { strengths: string[], weaknesses: string[], opportunities: string[], threats: string[] }
  - recommended_strategy: One of "Growth", "Efficiency", "Brand".
  
  Do NOT output markdown. Output ONLY valid JSON.`;

    const userPrompt = `
  Business: ${dossier.form_data.business.type} in ${dossier.form_data.business.sector}
  Objective: ${dossier.form_data.business.objective}
  Employees: ${dossier.form_data.business.employees}
  Maturity: ${dossier.form_data.level}
  Web Presence Score: ${score}/100
  `;

    // Fallback default
    let swot = {
        strengths: ["Experiencia en el sector"],
        weaknesses: ["Digitalización inicial"],
        opportunities: ["Automatización de procesos"],
        threats: ["Competencia digital agresiva"]
    };
    let strategy = "Efficiency";

    try {
        const response = await bindings.AI.run("@cf/meta/llama-3-8b-instruct", {
            messages: [
                { role: "system", content: systemPrompt },
                { role: "user", content: userPrompt }
            ]
        }) as { response?: string };

        if (response?.response) {
            // Attempt to parse JSON
            const clean = response.response.replace(/```json/g, "").replace(/```/g, "").trim();
            const parsed = JSON.parse(clean);
            if (parsed.swot) swot = parsed.swot;
            if (parsed.recommended_strategy) strategy = parsed.recommended_strategy;
        }
    } catch (err) {
        console.error("AI_ANALYSIS_FAILED", err);
        // Continue with deterministic fallback
    }

    let competitorsData: StrategicDossier["analysis_data"]["competitors_data"] | undefined;
    let competitorsFound = 0;

    try {
        const radiusValue = Number.parseFloat(String((dossier.form_data as any)?.competition?.radiusKm ?? "5"));
        const discovery = await discoverCompetitors({
            address: dossier.form_data.personal.address,
            city: dossier.form_data.personal.city,
            sector: dossier.form_data.business.sector,
            radiusKm: Number.isFinite(radiusValue) ? radiusValue : 5,
        });

        competitorsFound = discovery.competitors.length;
        competitorsData = {
            radius_km: discovery.radiusKm,
            resolved_address: discovery.resolvedAddress,
            warnings: discovery.warnings,
            items: discovery.competitors.map((item) => ({
                name: item.name,
                category: item.category,
                distance_km: item.distanceKm,
                website: item.website,
                social_urls: item.socialUrls,
                source: item.source,
            })),
        };
    } catch (error) {
        console.error("COMPETITORS_DISCOVERY_FAILED", error);
    }

    return {
        web_score: score,
        verified_maps: Boolean(hasMaps),
        competitors_found: competitorsFound,
        competitors_data: competitorsData,
        swot,
        recommended_strategy: strategy
    };
}
