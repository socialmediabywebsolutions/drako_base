export const dynamic = "force-dynamic";

import { NextResponse } from "next/server";
import { requireCurrentSocialFlowSession } from "@/lib/socialflow/auth/request";
import { getEmployeesByTenant, createEmployee } from "@/lib/socialflow/employees/repository";
import { parseEmployeePhysicalFields } from "@/lib/socialflow/employees/validation";

const DEFAULT_SAAS_ID = "socialflow";

function resolveSaasId(request: Request): string {
  return new URL(request.url).searchParams.get("saasId")?.trim() || DEFAULT_SAAS_ID;
}

export async function GET(req: Request) {
  let session: Awaited<ReturnType<typeof requireCurrentSocialFlowSession>>;
  try {
    session = await requireCurrentSocialFlowSession(req);
  } catch {
    return NextResponse.json({ error: "SESSION_REQUIRED" }, { status: 401 });
  }

  try {
    const employees = await getEmployeesByTenant(session.tenantId, resolveSaasId(req));
    return NextResponse.json({ ok: true, employees });
  } catch (err) {
    console.error("[Employees] list failed", err instanceof Error ? err.message : String(err));
    return NextResponse.json({ error: "LIST_FAILED" }, { status: 500 });
  }
}

export async function POST(req: Request) {
  let session: Awaited<ReturnType<typeof requireCurrentSocialFlowSession>>;
  try {
    session = await requireCurrentSocialFlowSession(req);
  } catch {
    return NextResponse.json({ error: "SESSION_REQUIRED" }, { status: 401 });
  }

  let body: {
    name?: string;
    role?: string;
    specialty?: string;
    description?: string;
    photoUrl?: string;
    active?: boolean;
    [key: string]: unknown;
  };
  try {
    body = await req.json();
  } catch {
    return NextResponse.json({ error: "INVALID_BODY" }, { status: 400 });
  }

  const name = body.name?.trim();
  if (!name) {
    return NextResponse.json({ error: "NAME_REQUIRED" }, { status: 400 });
  }

  try {
    const employee = await createEmployee(session.tenantId, resolveSaasId(req), {
      name,
      role: body.role?.trim() || null,
      specialty: body.specialty?.trim() || null,
      description: body.description?.trim() || null,
      photoUrl: body.photoUrl?.trim() || null,
      active: body.active,
      ...parseEmployeePhysicalFields(body),
    });
    return NextResponse.json({ ok: true, employee });
  } catch (err) {
    console.error("[Employees] create failed", err instanceof Error ? err.message : String(err));
    return NextResponse.json({ error: "CREATE_FAILED" }, { status: 500 });
  }
}
