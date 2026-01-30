import { NextResponse } from "next/server";
import { resolveBrandingContext, upsertSaasBrandingSettings } from "@/lib/branding/repository";
import { BrandingLayoutDensity } from "@/lib/branding/types";

// export const runtime = "edge"; // OpenNext Migration

/**
 * POST /api/campamento-base/provisioning/branding
 * Materializa la identidad visual del SaaS
 */
export async function POST(request: Request) {
    const tenantId = request.headers.get("x-drako-tenant-id");

    if (!tenantId) {
        return NextResponse.json({ error: "Missing tenant context" }, { status: 400 });
    }

    try {
        const body = (await request.json()) as {
            saasId: string;
            primary: string;
            secondary: string;
            accent: string;
            background: string;
            surface: string;
            text: string;
            enableDarkMode: boolean;
            layoutDensity: BrandingLayoutDensity;
        };

        const { saasId, primary, secondary, accent, background, surface, text, enableDarkMode, layoutDensity } = body;

        if (!saasId) {
            return NextResponse.json({ error: "Missing saasId" }, { status: 400 });
        }

        // 1. Resolve Branding Context
        const ctx = await resolveBrandingContext({ tenantId, saasId });

        // 2. Upsert Branding Settings
        const settings = await upsertSaasBrandingSettings(ctx, {
            saasId,
            primaryColor: primary,
            secondaryColor: secondary,
            accentColor: accent,
            backgroundColor: background,
            surfaceColor: surface,
            textColor: text,
            dangerColor: "#ef4444", // Default danger
            successColor: "#22c55e", // Default success
            enableDarkMode,
            layoutDensity,
            metadata: { materializedAt: new Date().toISOString(), source: "DrakoFoundry_BrandingForge" }
        });

        return NextResponse.json({
            success: true,
            message: "Identidad visual forjada exitosamente.",
            settings
        });

    } catch (error) {
        console.error("BRANDING_PROVISIONING_ERROR", error);
        return NextResponse.json(
            {
                error: "Failed to materialize branding layer",
                message: error instanceof Error ? error.message : String(error),
            },
            { status: 500 },
        );
    }
}
