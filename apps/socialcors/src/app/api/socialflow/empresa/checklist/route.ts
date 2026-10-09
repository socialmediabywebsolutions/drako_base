export const dynamic = "force-dynamic";

import { NextResponse } from "next/server";
import { requireCurrentSocialFlowSession } from "@/lib/socialflow/auth/request";
import { getEmpresaChecklist } from "@/lib/socialflow/onboarding/checklistRepository";

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
    const checklist = await getEmpresaChecklist(session.tenantId, resolveSaasId(req));
    return NextResponse.json({ ok: true, ...checklist });
  } catch (err) {
    console.error("[EmpresaChecklist] get failed", err instanceof Error ? err.message : String(err));
    return NextResponse.json({ error: "CHECKLIST_FAILED" }, { status: 500 });
  }
}
