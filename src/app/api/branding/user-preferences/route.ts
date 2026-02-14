import { NextResponse } from "next/server";
import { requireTenantAccess, UnauthorizedError } from "@/lib/auth/session";
import { resolveBrandingContext, getUserUiPreferences, upsertUserUiPreferences } from "@/lib/branding/repository";
import type { BrandingLayoutDensity, BrandingRoleType } from "@/lib/branding/types";


const VALID_DENSITIES: BrandingLayoutDensity[] = ["COMPACT", "COZY", "NORMAL"];
const VALID_ROLES: BrandingRoleType[] = ["OWNER", "EMPLOYEE"];

function parseRole(value: string | null): BrandingRoleType | null {
  if (!value) return null;
  const normalized = value.trim().toUpperCase();
  return VALID_ROLES.includes(normalized as BrandingRoleType) ? (normalized as BrandingRoleType) : null;
}

export async function GET(request: Request) {
  try {
    const url = new URL(request.url);
    const saasId = url.searchParams.get("saasId");
    if (!saasId) {
      return NextResponse.json({ code: "INVALID_PARAMS", message: "saasId is required" }, { status: 400 });
    }
    const { tenantId, session } = await requireTenantAccess(request);
    const userId = url.searchParams.get("userId")?.trim() || session.email;
    const roleType = parseRole(url.searchParams.get("roleType")) ?? (session.role === "admin" ? "OWNER" : "OWNER");
    const ctx = await resolveBrandingContext({ tenantId, saasId });
    const preferences = await getUserUiPreferences(ctx, userId);
    return NextResponse.json({ preferences, userId, roleType });
  } catch (error) {
    if (error instanceof UnauthorizedError) {
      return NextResponse.json({ code: "UNAUTHORIZED", message: error.message }, { status: error.status });
    }
    console.error("BRANDING_PREFERENCES_GET", error);
    return NextResponse.json({ code: "BRANDING_PREFS_ERROR", message: "No se pudieron cargar las preferencias" }, { status: 500 });
  }
}

export async function PATCH(request: Request) {
  try {
    const body = (await request.json().catch(() => null)) as {
      saasId?: string | null;
      userId?: string | null;
      roleType?: string | null;
      layoutDensityOverride?: BrandingLayoutDensity | null;
      defaultSection?: string | null;
      hiddenWidgets?: string[] | null;
      metadata?: Record<string, unknown> | null;
    } | null;

    if (!body?.saasId) {
      return NextResponse.json({ code: "INVALID_BODY", message: "saasId is required" }, { status: 400 });
    }

    const { tenantId, session } = await requireTenantAccess(request);
    const userId = body.userId?.trim() || session.email;
    const roleType = parseRole(body.roleType ?? null) ?? (session.role === "admin" ? "OWNER" : "OWNER");

    if (body.layoutDensityOverride && !VALID_DENSITIES.includes(body.layoutDensityOverride)) {
      return NextResponse.json({ code: "INVALID_BODY", message: "Invalid layoutDensityOverride" }, { status: 400 });
    }

    const ctx = await resolveBrandingContext({ tenantId, saasId: body.saasId });
    const preferences = await upsertUserUiPreferences(ctx, userId, {
      roleType,
      layoutDensityOverride: body.layoutDensityOverride ?? null,
      defaultSection: body.defaultSection ?? null,
      hiddenWidgets: body.hiddenWidgets ?? null,
      metadata: body.metadata ?? null,
    });
    return NextResponse.json({ preferences });
  } catch (error) {
    if (error instanceof UnauthorizedError) {
      return NextResponse.json({ code: "UNAUTHORIZED", message: error.message }, { status: error.status });
    }
    console.error("BRANDING_PREFERENCES_PATCH", error);
    return NextResponse.json({ code: "BRANDING_PREFS_ERROR", message: "No se pudieron guardar las preferencias" }, { status: 500 });
  }
}
