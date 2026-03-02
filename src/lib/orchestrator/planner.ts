import { env } from '@/lib/cf';
import type { StrategicDossier, SaaSBlueprint } from './types';

/**
 * DETERMINISTIC PLANNER ENGINE
 * Translates Strategy (Dossier) -> Execution (Blueprint)
 */
export async function generateSaaSBlueprint(dossier: StrategicDossier): Promise<SaaSBlueprint> {
    const bindings = env();
    const ai = bindings?.AI;

    if (!ai) {
        throw new Error("Drako Neural Core (AI Binding) Not Found");
    }

    const { business, digital } = dossier.form_data;
    const { swot, recommended_strategy } = dossier.analysis_data!;

    // 1. Construct the Architect Prompt
    const systemPrompt = `You are Drako, an elite SaaS Architect. 
Your goal is to design a high-converting, scalable SaaS Blueprint based on a client's business profile.
Output must be strict JSON. No chatter.`;

    const userPrompt = `
Client Profile:
- Sector: ${business.sector}
- Business Type: ${business.type} ("${business.objective}")
- Digital Maturity: ${dossier.analysis_data?.web_score}/100
- Strategy: ${recommended_strategy}

SWOT Context:
- Strength: ${swot.strengths[0]}
- Weakness: ${swot.weaknesses[0]}
- Opportunity: ${swot.opportunities[0]}

TASK:
Generate a SaaS Materialization Blueprint in JSON format with:
1. "architecture": The specific SaaS archetype (e.g., "Niche CRM", "Vertical Sandbox", "B2B Marketplace").
2. "tagline": A powerful, selling one-liner.
3. "modules": 4 core features. Priority 'critical'.
4. "stack": Specific tech stack recommendations (Next.js 14, Cloudflare D1, etc.).
5. "monetization": A tiered pricing model suitable for this sector.
6. "roadmap_steps": 5 step execution plan.

JSON Structure:
{
  "architecture": "string",
  "tagline": "string",
  "modules": [{ "name": "string", "description": "string", "priority": "critical" }],
  "stack": { "frontend": "string", "backend": "string", "database": "string", "hosting": "string" },
  "monetization": { "model": "string", "tiers": [{ "name": "string", "price": "string", "features": ["string"] }] },
  "roadmap_steps": ["string"]
}
`;

    // 2. Invoke Llama-3
    const response = await ai.run('@cf/meta/llama-3-8b-instruct', {
        messages: [
            { role: 'system', content: systemPrompt },
            { role: 'user', content: userPrompt }
        ],
        max_tokens: 1500,
        temperature: 0.2 // Low temperature for deterministic output
    }) as unknown;

    // 3. Parse JSON Output
    let raw = "{}";
    if (typeof response === "object" && response !== null && "response" in response) {
        raw = (response as { response?: unknown }).response as string;
    } else if (Array.isArray(response)) {
        raw = response.join(""); // Fallback just in case
    } else {
        // stream handling if needed, but usually .run returns {response: string} for non-stream
        raw = JSON.stringify(response);
    }

    // Clean markdown code blocks if Llama adds them
    raw = raw.replace(/```json/g, '').replace(/```/g, '').trim();

    try {
        const blueprint: SaaSBlueprint = JSON.parse(raw);
        // Force Standard Drako Stack where AI might hallucinate
        blueprint.stack.hosting = "Cloudflare Pages (Global)";
        blueprint.stack.database = "Cloudflare D1 (Edge SQL)";

        return blueprint;
    } catch (e) {
        console.error("Blueprint Parse Error", e, raw);
        throw new Error("Failed to parse Architect Blueprint");
    }
}
