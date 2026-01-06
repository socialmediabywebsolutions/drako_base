import { NextResponse } from "next/server";
import { requireTenantAccess } from "@/lib/auth/session";
import { resolveEmployeesContext } from "@/lib/employees/context";
import { handleEmployeesApiError } from "@/lib/employees/api-helpers";
import { loadHrSettings, saveHrSettings } from "@/lib/employees/repository";


export async function GET(request: Request) {
  try {
    const url = new URL(request.url);
    const saasId = url.searchParams.get("saasId");
    if (!saasId) {
      return NextResponse.json({ code: "INVALID_PARAMS", message: "saasId is required" }, { status: 400 });
    }
    const { tenantId } = await requireTenantAccess(request);
    const ctx = await resolveEmployeesContext(tenantId, saasId);
    const settings = await loadHrSettings(ctx);
    return NextResponse.json({ settings });
  } catch (error) {
    return handleEmployeesApiError("EMPLOYEES_HR_SETTINGS_GET", error, "EMPLOYEES_HR_SETTINGS_UNEXPECTED_ERROR");
  }
}

export async function PATCH(request: Request) {
  try {
    const url = new URL(request.url);
    const saasId = url.searchParams.get("saasId");
    if (!saasId) {
      return NextResponse.json({ code: "INVALID_PARAMS", message: "saasId is required" }, { status: 400 });
    }
    const body = (await request.json().catch(() => null)) as {
      minHourlyWage?: unknown;
      maxWeeklyHoursDefault?: unknown;
      blockOverwork?: unknown;
      blockUnderpay?: unknown;
      minRestHoursBetweenShifts?: unknown;
    } | null;
    if (!body) {
      return NextResponse.json({ code: "INVALID_BODY", message: "Body is required" }, { status: 400 });
    }
    const updates: {
      minHourlyWage?: number;
      maxWeeklyHoursDefault?: number;
      blockOverwork?: boolean;
      blockUnderpay?: boolean;
      minRestHoursBetweenShifts?: number;
    } = {};
    if (typeof body.minHourlyWage === "number" && !Number.isNaN(body.minHourlyWage)) {
      updates.minHourlyWage = body.minHourlyWage;
    }
    if (typeof body.maxWeeklyHoursDefault === "number" && !Number.isNaN(body.maxWeeklyHoursDefault)) {
      updates.maxWeeklyHoursDefault = body.maxWeeklyHoursDefault;
    }
    if (typeof body.blockOverwork === "boolean") {
      updates.blockOverwork = body.blockOverwork;
    }
    if (typeof body.blockUnderpay === "boolean") {
      updates.blockUnderpay = body.blockUnderpay;
    }
    if (typeof body.minRestHoursBetweenShifts === "number" && !Number.isNaN(body.minRestHoursBetweenShifts)) {
      updates.minRestHoursBetweenShifts = Math.max(0, body.minRestHoursBetweenShifts);
    }
    const { tenantId } = await requireTenantAccess(request);
    const ctx = await resolveEmployeesContext(tenantId, saasId);
    // TODO: Restrict PATCH access to OWNER/MANAGER roles when role metadata is available in session context.
    const settings = await saveHrSettings(ctx, updates);
    return NextResponse.json({ settings });
  } catch (error) {
    return handleEmployeesApiError("EMPLOYEES_HR_SETTINGS_PATCH", error, "EMPLOYEES_HR_SETTINGS_UNEXPECTED_ERROR");
  }
}
