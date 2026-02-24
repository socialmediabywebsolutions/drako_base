export const dynamic = "force-dynamic";

import { NextResponse } from "next/server";
import { requireTenantAccess } from "@/lib/auth/session";
import { resolveClinicContext } from "@/lib/clinic/context";
import { handleClinicApiError } from "@/lib/clinic/api-helpers";
import { getClinicProfile, saveClinicProfile } from "@/lib/clinic/repository";


export async function GET(request: Request) {
  try {
    const { tenantId } = await requireTenantAccess(request);
    const context = await resolveClinicContext(tenantId);
    const profile = await getClinicProfile(context);
    return NextResponse.json({ profile });
  } catch (error) {
    return handleClinicApiError("PROFILE_GET", error);
  }
}

export async function POST(request: Request) {
  try {
    const { tenantId } = await requireTenantAccess(request);
    const context = await resolveClinicContext(tenantId);
    const body = (await request.json().catch(() => null)) as {
      id?: string;
      displayName?: string;
      city?: string | null;
      roomsCount?: number;
      staffCount?: number;
      primaryGoal?: string | null;
      channels?: Record<string, boolean> | null;
    } | null;
    if (!body || !body.displayName || body.displayName.trim().length === 0) {
      return NextResponse.json(
        { code: "INVALID_BODY", message: "displayName is required" },
        { status: 400 },
      );
    }
    const profile = await saveClinicProfile(context, {
      id: body.id,
      saasId: context.saasId,
      clientId: context.clientId,
      displayName: body.displayName.trim(),
      city: typeof body.city === "string" ? body.city : null,
      roomsCount: typeof body.roomsCount === "number" ? body.roomsCount : undefined,
      staffCount: typeof body.staffCount === "number" ? body.staffCount : undefined,
      primaryGoal: typeof body.primaryGoal === "string" ? body.primaryGoal : null,
      channels: body.channels ?? undefined,
    });
    return NextResponse.json({ profile });
  } catch (error) {
    return handleClinicApiError("PROFILE_POST", error);
  }
}
