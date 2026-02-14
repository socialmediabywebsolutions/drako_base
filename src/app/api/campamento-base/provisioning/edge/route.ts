import { NextResponse } from "next/server";
import { provisionSaasInCloudflare } from "@/lib/campamento-base/provisioning/cloudflare-factory";
import { type SaasBlueprintDraft } from "@/lib/campamento-base/saas-factory-types";
import { type DracoEnv } from "@/lib/cf";
import { } from "@/lib/db";


/**
 * POST /api/campamento-base/provisioning/edge
 * Ejecuta el provisionamiento en Cloudflare (DNS, SSL, etc)
 */
export async function POST(request: Request) {
    const tenantId = request.headers.get("x-drako-tenant-id");

    if (!tenantId) {
        return NextResponse.json({ error: "Missing tenant context" }, { status: 400 });
    }

    try {
        const body = (await request.json()) as { saasId: string; subdomain: string; customDomain?: string | null };
        const { saasId, subdomain, customDomain } = body;

        if (!saasId || !subdomain) {
            return NextResponse.json(
                { error: "Missing required fields: saasId, subdomain" },
                { status: 400 },
            );
        }

        // 1. Mock/Adaptar el blueprint para el factory de Cloudflare
        // En una implementación real, recuperaríamos el blueprint de la DB.
        // Aquí simulamos el objeto SaasBlueprintDraft requerido.
        const mockBlueprint: unknown = {
            proposedSlug: subdomain,
            provisioning: {
                domains: {
                    primarySubdomain: subdomain,
                    primaryDomainType: customDomain ? "CUSTOM_DOMAIN_ALLOWED" : "SUBDOMAIN_ONLY",
                    customDomainRequested: customDomain ?? null
                }
            }
        };

        // 2. Ejecutar provisionamiento
        const result = await provisionSaasInCloudflare({
            blueprint: mockBlueprint as unknown as SaasBlueprintDraft,
            saasId: saasId,
            env: (globalThis as Record<string, unknown>).process as unknown as DracoEnv
        });

        if (result.status === "ERROR") {
            return NextResponse.json(
                {
                    error: "Provisioning failed",
                    message: result.message,
                },
                { status: 500 },
            );
        }

        return NextResponse.json({
            success: true,
            status: result.status,
            message: result.message,
            metadata: result.payloads,
            dnsRecord: result.createdDnsRecord,
            customHostname: result.createdCustomHostname
        });
    } catch (error) {
        console.error("EDGE_PROVISIONING_ERROR", error);
        return NextResponse.json(
            {
                error: "Failed to provision infrastructure",
                message: error instanceof Error ? error.message : String(error),
            },
            { status: 500 },
        );
    }
}
