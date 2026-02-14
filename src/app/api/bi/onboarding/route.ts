import { NextResponse } from "next/server";
import { saveBusinessKnowledge, generateSituationalAnalysis } from "@/lib/campamento-base/bi/knowledge-base";


/**
 * POST /api/bi/onboarding
 * Recibe los datos de la entrevista y genera el análisis inicial
 */
export async function POST(request: Request) {
    const tenantId = request.headers.get("x-drako-tenant-id");

    if (!tenantId) {
        return NextResponse.json({ error: "Missing tenant context" }, { status: 400 });
    }

    try {
        const body = (await request.json()) as {
            companyId: string;
            socialProfiles: { facebook?: string; instagram?: string; linkedin?: string };
            location: { address: string };
            operatingCosts: {
                rent: number;
                electricity: number;
                water: number;
                gas: number;
                labor: number;
                other: number;
            };
            fiscalInfo: { taxId: string; address: string };
        };

        // Guardar KB
        await saveBusinessKnowledge({
            tenantId,
            companyId: body.companyId,
            socialProfiles: body.socialProfiles,
            location: body.location,
            operatingCosts: body.operatingCosts,
            fiscalInfo: body.fiscalInfo
        });

        // Generar Análisis
        const analysis = await generateSituationalAnalysis(tenantId, body.companyId);

        return NextResponse.json({
            success: true,
            analysis
        });
    } catch (error) {
        console.error("BI_ONBOARDING_ERROR", error);
        return NextResponse.json(
            { error: "Failed to process business knowledge", message: String(error) },
            { status: 500 }
        );
    }
}
