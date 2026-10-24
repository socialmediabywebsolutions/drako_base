import { FUNDING_PORTALS, generateFundingOpportunities } from "../../../src/lib/drako/funding-generator";

// Agente de Financiación — cron "0 8 * * 1" (lunes 08:00 UTC). Los portales oficiales
// no tienen API pública: el agente comprueba que cada uno responde, genera las
// oportunidades deterministas de la semana (src/lib/drako/funding-generator.ts) y las
// envía a POST /api/funding/opportunities de saas-drakos-prod por service binding.

export type Env = {
    DRAKOS?: Fetcher;
    CRON_SECRET?: string;
    INTERNAL_API_SECRET?: string;
};

async function checkPortal(url: string): Promise<number | null> {
    try {
        const response = await fetch(url, {
            method: "GET",
            redirect: "follow",
            headers: { "User-Agent": "DrakoFundingAgent/1.0 (+https://drako.systems)" },
            signal: AbortSignal.timeout(10_000),
        });
        return response.status;
    } catch {
        return null;
    }
}

export async function runFundingAgent(env: Env): Promise<number> {
    const token = (typeof env.CRON_SECRET === "string" && env.CRON_SECRET.trim())
        || (typeof env.INTERNAL_API_SECRET === "string" && env.INTERNAL_API_SECRET.trim())
        || "";
    if (!env.DRAKOS || !token) {
        console.error("[funding-agent] skipped", { hasBinding: Boolean(env.DRAKOS), hasToken: Boolean(token) });
        return 0;
    }

    const statuses = await Promise.all(FUNDING_PORTALS.map(async (portal) => ({ portal: portal.id, status: await checkPortal(portal.url) })));
    for (const { portal, status } of statuses) {
        if (status !== 200) console.warn("[funding-agent] portal no responde 200", { portal, status });
    }

    const opportunities = generateFundingOpportunities();
    const response = await env.DRAKOS.fetch("https://drako.systems/api/funding/opportunities", {
        method: "POST",
        headers: { Authorization: `Bearer ${token}`, "Content-Type": "application/json" },
        body: JSON.stringify(opportunities),
    });
    const body = await response.text();
    if (!response.ok) {
        console.error("[funding-agent] POST failed", { status: response.status, body: body.slice(0, 500) });
        return 0;
    }

    try {
        const parsed = JSON.parse(body) as { inserted?: number };
        return typeof parsed.inserted === "number" ? parsed.inserted : 0;
    } catch {
        return 0;
    }
}
