import { NextResponse } from "next/server";
import { requireTenantAccess } from "@/lib/auth/session";
import { handleKnowledgeApiError } from "@/lib/knowledge/api-helpers";
import { getKnowledgeDocumentById, resolveKnowledgeContext, updateKnowledgeDocument } from "@/lib/knowledge/repository";
import type {
  KnowledgeAudience,
  KnowledgeImportance,
  SaasKnowledgeDocumentStatus,
  SaasKnowledgeDocumentType,
} from "@/lib/knowledge/types";

export const runtime = "edge";

const AUDIENCE_VALUES: KnowledgeAudience[] = ["OWNER", "STAFF", "BOTH"];
const IMPORTANCE_VALUES: KnowledgeImportance[] = ["INFO", "STANDARD", "CRITICAL"];

type RouteContext = {
  params: Promise<{ id: string }>;
};

export async function GET(request: Request, { params }: RouteContext) {
  try {
    const url = new URL(request.url);
    const saasId = url.searchParams.get("saasId");
    const { id } = await params;
    if (!saasId || !id) {
      return NextResponse.json({ code: "INVALID_PARAMS", message: "saasId and id are required" }, { status: 400 });
    }
    const { tenantId } = await requireTenantAccess(request);
    const ctx = await resolveKnowledgeContext({ tenantId, saasId });
    const document = await getKnowledgeDocumentById(ctx, id);
    if (!document) {
      return NextResponse.json({ code: "NOT_FOUND", message: "Document not found" }, { status: 404 });
    }
    return NextResponse.json({ document });
  } catch (error) {
    return handleKnowledgeApiError("KNOWLEDGE_DOCUMENT_DETAIL", error, "KNOWLEDGE_DOCUMENT_DETAIL_ERROR");
  }
}

export async function PATCH(request: Request, { params }: RouteContext) {
  try {
    const url = new URL(request.url);
    const saasId = url.searchParams.get("saasId");
    const { id } = await params;
    if (!saasId || !id) {
      return NextResponse.json({ code: "INVALID_PARAMS", message: "saasId and id are required" }, { status: 400 });
    }
    const body = (await request.json().catch(() => null)) as {
      spaceId?: string | null;
      title?: string;
      type?: SaasKnowledgeDocumentType;
      status?: SaasKnowledgeDocumentStatus;
      audience?: KnowledgeAudience;
      importance?: KnowledgeImportance;
      summary?: string | null;
      content?: string;
      tags?: string[] | null;
      metadata?: Record<string, unknown> | null;
    } | null;
    if (!body) {
      return NextResponse.json({ code: "INVALID_BODY", message: "Body is required" }, { status: 400 });
    }
    if (body.audience && !AUDIENCE_VALUES.includes(body.audience)) {
      return NextResponse.json({ code: "INVALID_BODY", message: "audience no es válido" }, { status: 400 });
    }
    if (body.importance && !IMPORTANCE_VALUES.includes(body.importance)) {
      return NextResponse.json({ code: "INVALID_BODY", message: "importance no es válido" }, { status: 400 });
    }
    const { tenantId } = await requireTenantAccess(request);
    const ctx = await resolveKnowledgeContext({ tenantId, saasId });
    const document = await updateKnowledgeDocument(ctx, id, {
      spaceId: typeof body.spaceId === "undefined" ? undefined : body.spaceId,
      title: body.title,
      type: body.type,
      status: body.status,
      audience: body.audience,
      importance: body.importance,
      summary: typeof body.summary === "undefined" ? undefined : body.summary,
      content: body.content,
      tags: typeof body.tags === "undefined" ? undefined : body.tags,
      metadata: typeof body.metadata === "undefined" ? undefined : body.metadata,
    });
    if (!document) {
      return NextResponse.json({ code: "NOT_FOUND", message: "Document not found" }, { status: 404 });
    }
    return NextResponse.json({ document });
  } catch (error) {
    return handleKnowledgeApiError("KNOWLEDGE_DOCUMENT_UPDATE", error, "KNOWLEDGE_DOCUMENT_UPDATE_ERROR");
  }
}
