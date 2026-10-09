export const dynamic = "force-dynamic";

import { NextResponse } from "next/server";
import { requireCurrentSocialFlowSession } from "@/lib/socialflow/auth/request";
import { deleteKnowledgeDoc } from "@/lib/socialflow/knowledge/repository";

const DEFAULT_SAAS_ID = "socialflow";

function resolveSaasId(request: Request): string {
  return new URL(request.url).searchParams.get("saasId")?.trim() || DEFAULT_SAAS_ID;
}

export async function DELETE(
  req: Request,
  { params }: { params: { id: string } },
) {
  let session: Awaited<ReturnType<typeof requireCurrentSocialFlowSession>>;
  try {
    session = await requireCurrentSocialFlowSession(req);
  } catch {
    return NextResponse.json({ error: "SESSION_REQUIRED" }, { status: 401 });
  }

  const { id } = params;
  if (!id) {
    return NextResponse.json({ error: "ID_REQUIRED" }, { status: 400 });
  }

  try {
    const deleted = await deleteKnowledgeDoc(id, session.tenantId, resolveSaasId(req));
    if (!deleted) {
      return NextResponse.json({ error: "NOT_FOUND" }, { status: 404 });
    }
    return NextResponse.json({ ok: true });
  } catch (err) {
    console.error("[Knowledge/delete] failed", err instanceof Error ? err.message : String(err));
    return NextResponse.json({ error: "DELETE_FAILED" }, { status: 500 });
  }
}
