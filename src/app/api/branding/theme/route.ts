export const dynamic = "force-dynamic";

import { NextResponse } from "next/server";
import { requireTenantAccess, UnauthorizedError } from "@/lib/auth/session";
import { resolveBrandingContext, resolveEffectiveTheme } from "@/lib/branding/repository";
import type { BrandingRoleType } from "@/lib/branding/types";


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
    const theme = await resolveEffectiveTheme(ctx, { userId, roleType });
    return NextResponse.json({ theme });
  } catch (error) {
    if (error instanceof UnauthorizedError) {
      return NextResponse.json({ code: "UNAUTHORIZED", message: error.message }, { status: error.status });
    }
    console.error("BRANDING_THEME_GET", error);
    return NextResponse.json({ code: "BRANDING_THEME_ERROR", message: "No se pudo cargar el tema" }, { status: 500 });
  }
}
