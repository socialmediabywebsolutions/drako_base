import { NextResponse } from "next/server";
import { requireTenantAccess, UnauthorizedError } from "@/lib/auth/session";
import { getEmailIntakeSnapshot, resolveEmailIntakeContext, EmailIntakeContextError } from "@/lib/email-intake/repository";
export const runtime = "edge";


export async function GET(request: Request) {
  try {
    const url = new URL(request.url);
    const saasId = url.searchParams.get("saasId");
    if (!saasId) {
      return NextResponse.json({ code: "INVALID_PARAMS", message: "saasId is required" }, { status: 400 });
    }
    const { tenantId } = await requireTenantAccess(request);
    const ctx = await resolveEmailIntakeContext({ tenantId, saasId });
    const snapshot = await getEmailIntakeSnapshot(ctx);
    return NextResponse.json({ snapshot });
  } catch (error) {
    if (error instanceof EmailIntakeContextError) {
      return NextResponse.json({ code: "INVALID_EMAIL_CONTEXT", message: error.message }, { status: 400 });
    }
    if (error instanceof UnauthorizedError) {
      return NextResponse.json({ code: "UNAUTHORIZED", message: error.message }, { status: error.status });
    }
    console.error("EMAIL_INTAKE_SUMMARY_GET", error);
    return NextResponse.json({ code: "EMAIL_INTAKE_ERROR", message: "No se pudo cargar el resumen" }, { status: 500 });
  }
}
