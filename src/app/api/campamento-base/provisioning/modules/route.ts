export const dynamic = "force-dynamic";

import { NextResponse } from "next/server";
import { getProjectEntitlements, upsertProjectEntitlements } from "@/lib/projects/entitlements";


/**
 * POST /api/campamento-base/provisioning/modules
 * Materializa módulos funcionales específicos en los entitlements del proyecto
 */
export async function POST(request: Request) {
    const tenantId = request.headers.get("x-drako-tenant-id") || "demo";

    try {
        const body = (await request.json()) as { saasId: string; modules: string[] };
        const { saasId, modules } = body;

        if (!saasId || !Array.isArray(modules)) {
            return NextResponse.json({ error: "Missing saasId or invalid modules array" }, { status: 400 });
        }

        // 1. Obtener entitlements actuales
        const currentEntitlements = await getProjectEntitlements({ tenantId, projectId: saasId });

        // 2. Fusionar features existentes con los nuevos módulos
        const updatedFeatures = Array.from(new Set([...currentEntitlements.enabledFeatures, ...modules]));

        // 3. Persistir actualización
        const updated = await upsertProjectEntitlements({
            tenantId,
            projectId: saasId,
            entitlements: {
                ...currentEntitlements,
                enabledFeatures: updatedFeatures,
                metadata: {
                    ...currentEntitlements.metadata,
                    lastModuleUpdate: new Date().toISOString(),
                    moduleProvisioning: "DrakoFoundry_ModuleForge_v1.0"
                }
            }
        });

        return NextResponse.json({
            success: true,
            message: "Módulos funcionales materializados exitosamente.",
            entitlements: updated
        });

    } catch (error) {
        console.error("MODULE_PROVISIONING_ERROR", error);
        return NextResponse.json(
            {
                error: "Failed to materialize functional layer",
                message: error instanceof Error ? error.message : String(error),
            },
            { status: 500 },
        );
    }
}
