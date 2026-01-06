import { NextResponse } from "next/server";
import { requireTenantAccess, UnauthorizedError } from "@/lib/auth/session";
import {
  getSaasBrandingSettings,
  resolveBrandingContext,
  upsertSaasBrandingSettings,
} from "@/lib/branding/repository";
import type { BrandingLayoutDensity } from "@/lib/branding/types";
export const runtime = "edge";


const VALID_DENSITIES: BrandingLayoutDensity[] = ["COMPACT", "COZY", "NORMAL"];

function isHexColor(value?: string | null): boolean {
  if (!value) return false;
  return /^#([0-9a-fA-F]{3}|[0-9a-fA-F]{6})$/.test(value.trim());
}

export async function GET(request: Request) {
  try {
    const url = new URL(request.url);
    const saasId = url.searchParams.get("saasId");
    if (!saasId) {
      return NextResponse.json({ code: "INVALID_PARAMS", message: "saasId is required" }, { status: 400 });
    }
    const { tenantId } = await requireTenantAccess(request);
    const ctx = await resolveBrandingContext({ tenantId, saasId });
    const settings = await getSaasBrandingSettings(ctx);
    return NextResponse.json({ settings });
  } catch (error) {
    if (error instanceof UnauthorizedError) {
      return NextResponse.json({ code: "UNAUTHORIZED", message: error.message }, { status: error.status });
    }
    console.error("BRANDING_SETTINGS_GET", error);
    return NextResponse.json({ code: "BRANDING_SETTINGS_ERROR", message: "No se pudo cargar el branding" }, { status: 500 });
  }
}

export async function PATCH(request: Request) {
  try {
    const body = (await request.json().catch(() => null)) as {
      saasId?: string | null;
      primaryColor?: string;
      secondaryColor?: string;
      accentColor?: string;
      backgroundColor?: string;
      surfaceColor?: string;
      textColor?: string;
      dangerColor?: string;
      successColor?: string;
      logoUrl?: string | null;
      faviconUrl?: string | null;
      heroImageUrl?: string | null;
      layoutDensity?: BrandingLayoutDensity;
      enableDarkMode?: boolean;
      metadata?: Record<string, unknown> | null;
    } | null;

    if (!body?.saasId) {
      return NextResponse.json({ code: "INVALID_BODY", message: "saasId is required" }, { status: 400 });
    }
    const { tenantId, session } = await requireTenantAccess(request);
    if (session.role !== "admin") {
      return NextResponse.json({ code: "FORBIDDEN", message: "Owner permissions required" }, { status: 403 });
    }
    if (body.layoutDensity && !VALID_DENSITIES.includes(body.layoutDensity)) {
      return NextResponse.json({ code: "INVALID_BODY", message: "Invalid layoutDensity" }, { status: 400 });
    }

    const colorFields = [
      body.primaryColor,
      body.secondaryColor,
      body.accentColor,
      body.backgroundColor,
      body.surfaceColor,
      body.textColor,
      body.dangerColor,
      body.successColor,
    ];
    if (colorFields.some((value) => value && !isHexColor(value))) {
      return NextResponse.json({ code: "INVALID_BODY", message: "Invalid hex color value" }, { status: 400 });
    }

    const ctx = await resolveBrandingContext({ tenantId, saasId: body.saasId });
    const current = await getSaasBrandingSettings(ctx);
    const saved = await upsertSaasBrandingSettings(ctx, {
      saasId: body.saasId,
      primaryColor: body.primaryColor ?? current?.primaryColor ?? "#1f2937",
      secondaryColor: body.secondaryColor ?? current?.secondaryColor ?? "#475569",
      accentColor: body.accentColor ?? current?.accentColor ?? "#f59e0b",
      backgroundColor: body.backgroundColor ?? current?.backgroundColor ?? "#0b0b0f",
      surfaceColor: body.surfaceColor ?? current?.surfaceColor ?? "#14141d",
      textColor: body.textColor ?? current?.textColor ?? "#f5f5f5",
      dangerColor: body.dangerColor ?? current?.dangerColor ?? "#ef4444",
      successColor: body.successColor ?? current?.successColor ?? "#22c55e",
      logoUrl: body.logoUrl ?? current?.logoUrl ?? null,
      faviconUrl: body.faviconUrl ?? current?.faviconUrl ?? null,
      heroImageUrl: body.heroImageUrl ?? current?.heroImageUrl ?? null,
      layoutDensity: body.layoutDensity ?? current?.layoutDensity ?? "NORMAL",
      enableDarkMode:
        typeof body.enableDarkMode === "boolean"
          ? body.enableDarkMode
          : current?.enableDarkMode ?? true,
      metadata: body.metadata ?? current?.metadata ?? null,
    });
    return NextResponse.json({ settings: saved });
  } catch (error) {
    if (error instanceof UnauthorizedError) {
      return NextResponse.json({ code: "UNAUTHORIZED", message: error.message }, { status: error.status });
    }
    console.error("BRANDING_SETTINGS_PATCH", error);
    return NextResponse.json({ code: "BRANDING_SETTINGS_ERROR", message: "No se pudo guardar el branding" }, { status: 500 });
  }
}
