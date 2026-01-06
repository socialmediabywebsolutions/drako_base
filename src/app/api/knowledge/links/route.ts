import { NextResponse } from "next/server";
import { requireTenantAccess } from "@/lib/auth/session";
import { handleKnowledgeApiError } from "@/lib/knowledge/api-helpers";
import { createKnowledgeLink, resolveKnowledgeContext } from "@/lib/knowledge/repository";
import type { SaasKnowledgeLinkTargetType } from "@/lib/knowledge/types";


export async function POST(request: Request) {
  try {
    const body = (await request.json().catch(() => null)) as {
      saasId?: string | null;
      documentId?: string;
      targetType?: SaasKnowledgeLinkTargetType;
      targetId?: string;
    } | null;
    if (!body?.saasId || !body.documentId || !body.targetType || !body.targetId) {
      return NextResponse.json(
        { code: "INVALID_BODY", message: "saasId, documentId, targetType and targetId are required" },
        { status: 400 },
      );
    }
    const { tenantId } = await requireTenantAccess(request);
    const ctx = await resolveKnowledgeContext({ tenantId, saasId: body.saasId });
    const link = await createKnowledgeLink(ctx, {
      saasId: body.saasId,
      documentId: body.documentId,
      targetType: body.targetType,
      targetId: body.targetId,
    });
    return NextResponse.json({ link });
  } catch (error) {
    return handleKnowledgeApiError("KNOWLEDGE_LINK_CREATE", error, "KNOWLEDGE_LINK_CREATE_ERROR");
  }
}
