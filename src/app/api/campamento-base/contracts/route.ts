import { NextRequest, NextResponse } from "next/server";
import { ContractService } from "@/lib/campamento-base/contracts/service";
import { resolveTenantId } from "@/lib/tenants/services";
import type { BlueprintResponse } from "@/lib/campamento-base/ai-blueprint-v2/prompts";


export async function POST(req: NextRequest) {
    try {
        const tenantId = resolveTenantId();
        const body = (await req.json()) as { projectId: string; projectName?: string; blueprint: Record<string, unknown> };
        const { projectId, projectName, blueprint } = body;
        const blueprintRes = blueprint as unknown as BlueprintResponse;

        if (!projectId || !blueprint) {
            return NextResponse.json({ error: "Missing required data" }, { status: 400 });
        }

        const contract = await ContractService.generateFromBlueprint(
            tenantId,
            projectId,
            projectName || "Proyecto Sin Nombre",
            blueprintRes
        );

        return NextResponse.json({ contract });
    } catch (error) {
        console.error("Contract API Error:", error);
        return NextResponse.json({ error: "Internal Server Error" }, { status: 500 });
    }
}

export async function PATCH(req: NextRequest) {
    try {
        const tenantId = resolveTenantId();
        const body = (await req.json()) as { contractId: string; metadata: Record<string, unknown> };
        const { contractId, metadata } = body;
        const ip = req.headers.get("x-real-ip") || req.headers.get("cf-connecting-ip") || "0.0.0.0";

        if (!contractId) {
            return NextResponse.json({ error: "Missing contractId" }, { status: 400 });
        }

        const success = await ContractService.signContract(
            contractId,
            tenantId,
            ip,
            JSON.stringify(metadata || {})
        );

        if (!success) {
            return NextResponse.json({ error: "Could not sign contract" }, { status: 400 });
        }

        return NextResponse.json({ ok: true });
    } catch (error) {
        console.error("Contract Signing Error:", error);
        return NextResponse.json({ error: "Internal Server Error" }, { status: 500 });
    }
}
