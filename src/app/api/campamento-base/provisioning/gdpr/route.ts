export const dynamic = "force-dynamic";

import { NextResponse } from "next/server";
import { runAi } from "@/lib/ai/client";


/**
 * POST /api/campamento-base/provisioning/gdpr
 * Materializa los documentos legales (Privacy Policy, ToS) basados en el blueprint
 */
export async function POST(request: Request) {
    const tenantId = request.headers.get("x-drako-tenant-id") || "demo";

    try {
        const body = (await request.json()) as { saasId: string; projectName: string; vertical?: string; businessVision?: string };
        const { saasId, projectName, vertical, businessVision } = body;

        if (!saasId || !projectName) {
            return NextResponse.json({ error: "Missing required parameters" }, { status: 400 });
        }

        // 1. Generate Legal Documents using AI
        const prompt = `You are a Legal Compliance Expert for SaaS companies (GDPR focus).
        Generate two legal documents for a specific SaaS project:
        1. Privacy Policy (Markdown format)
        2. Terms of Service (Markdown format)

        Project Context:
        - Name: ${projectName}
        - Vertical: ${vertical || "Professional Services"}
        - Vision: ${businessVision || "Automated Business SaaS"}

        Formatting Rules:
        - Response MUST be a JSON object with two keys: "privacyPolicy" and "termsOfService".
        - Use Markdown for internal content.
        - Ensure names and verticals are correctly used.
        - Tono: Profesional, robusto y protector.
        - Idioma: ESPAÑOL.

        JSON structure:
        {
          "privacyPolicy": "# Política de Privacidad...",
          "termsOfService": "# Términos y Condiciones..."
        }
        `;

        const aiRes = await runAi({
            mode: "smart",
            tenantId,
            messages: [
                { role: "system", content: "You are an Elite Legal Architect. Respond ONLY with the requested JSON." },
                { role: "user", content: prompt }
            ]
        });

        if (!aiRes.ok || !aiRes.content) {
            throw new Error("Failed to generate legal documents via AI");
        }

        // Parse JSON safely
        const startIdx = aiRes.content.indexOf("{");
        const endIdx = aiRes.content.lastIndexOf("}");
        const jsonPart = aiRes.content.slice(startIdx, endIdx + 1);
        const docs = JSON.parse(jsonPart);

        return NextResponse.json({
            success: true,
            documents: docs,
            materializedAt: new Date().toISOString()
        });

    } catch (error) {
        console.error("GDPR_PROVISIONING_ERROR", error);
        return NextResponse.json(
            {
                error: "Failed to materialize legal shield",
                message: error instanceof Error ? error.message : String(error),
            },
            { status: 500 },
        );
    }
}
