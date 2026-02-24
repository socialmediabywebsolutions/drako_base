export const dynamic = "force-dynamic";

import { NextResponse } from "next/server";
import { runAi } from "@/lib/ai/client";


/**
 * POST /api/campamento-base/provisioning/marketing
 * Materializa el plan de crecimiento (Growth Plan) basado en el blueprint
 */
export async function POST(request: Request) {
    const tenantId = request.headers.get("x-drako-tenant-id") || "demo";

    try {
        const body = (await request.json()) as { saasId: string; projectName: string; vertical?: string; businessVision: string };
        const { saasId, projectName, vertical, businessVision } = body;

        if (!saasId || !projectName) {
            return NextResponse.json({ error: "Missing required parameters" }, { status: 400 });
        }

        // 1. Generate Growth Plan using AI
        const prompt = `You are an Elite Growth Marketer & Sales Architect.
        Materialize a 'Neural Marketing Plan' for this SaaS project:
        
        Project: ${projectName}
        Vertical: ${vertical || "SaaS"}
        Vision: ${businessVision}

        Structure your response as a JSON with:
        1. "targetAudience": Broad and Niche.
        2. "contentPillars": 3 tactical areas for social media.
        3. "activeSalesHooks": 3 direct messages for AI Sales Agents (LinkedIn/Email).
        4. "growthRoadmap": 3 steps for the first 30 days.

        Formatting:
        - Language: ESPAÑOL.
        - Tone: Aggressive, high-fidelity, and tactical.
        - Response: ONLY JSON.
        `;

        const aiRes = await runAi({
            mode: "smart",
            tenantId,
            messages: [
                { role: "system", content: "You are the Marketing Autopilot Core. Respond ONLY with JSON." },
                { role: "user", content: prompt }
            ]
        });

        if (!aiRes.ok || !aiRes.content) {
            throw new Error("Failed to generate growth plan via AI");
        }

        // Parse JSON
        const startIdx = aiRes.content.indexOf("{");
        const endIdx = aiRes.content.lastIndexOf("}");
        const jsonPart = aiRes.content.slice(startIdx, endIdx + 1);
        const plan = JSON.parse(jsonPart);

        return NextResponse.json({
            success: true,
            plan,
            materializedAt: new Date().toISOString()
        });

    } catch (error) {
        console.error("MARKETING_PROVISIONING_ERROR", error);
        return NextResponse.json(
            {
                error: "Failed to materialize growth swarm",
                message: error instanceof Error ? error.message : String(error),
            },
            { status: 500 },
        );
    }
}
