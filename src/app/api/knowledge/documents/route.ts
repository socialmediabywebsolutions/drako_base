export const dynamic = "force-dynamic";

import { NextResponse } from "next/server";
import { requireTenantAccess } from "@/lib/auth/session";
import { handleKnowledgeApiError } from "@/lib/knowledge/api-helpers";
import { createKnowledgeDocument, listKnowledgeDocuments, resolveKnowledgeContext } from "@/lib/knowledge/repository";
import type {
  KnowledgeAudience,
  KnowledgeImportance,
  SaasKnowledgeDocumentSource,
  SaasKnowledgeDocumentStatus,
  SaasKnowledgeDocumentType,
  SaasKnowledgeLinkTargetType,
} from "@/lib/knowledge/types";


const AUDIENCE_VALUES: KnowledgeAudience[] = ["OWNER", "STAFF", "BOTH"];
const IMPORTANCE_VALUES: KnowledgeImportance[] = ["INFO", "STANDARD", "CRITICAL"];

export async function GET(request: Request) {
  try {
    const url = new URL(request.url);
    const saasId = url.searchParams.get("saasId");
    if (!saasId) {
      return NextResponse.json({ code: "INVALID_PARAMS", message: "saasId is required" }, { status: 400 });
    }
    const params = {
      spaceId: url.searchParams.get("spaceId"),
      status: url.searchParams.get("status") as SaasKnowledgeDocumentStatus | null,
      tag: url.searchParams.get("tag"),
      searchQuery: url.searchParams.get("q"),
      targetType: url.searchParams.get("targetType") as SaasKnowledgeLinkTargetType | null,
      targetId: url.searchParams.get("targetId"),
    };
    const { tenantId } = await requireTenantAccess(request);
    const ctx = await resolveKnowledgeContext({ tenantId, saasId });
    const items = await listKnowledgeDocuments(ctx, params);
    return NextResponse.json({ items, count: items.length });
  } catch (error) {
    return handleKnowledgeApiError("KNOWLEDGE_DOCUMENTS_LIST", error, "KNOWLEDGE_DOCUMENTS_ERROR");
  }
}

export async function POST(request: Request) {
  try {
    const body = (await request.json().catch(() => null)) as {
      saasId?: string | null;
      spaceId?: string | null;
      title?: string;
      type?: SaasKnowledgeDocumentType;
      source?: SaasKnowledgeDocumentSource;
      status?: SaasKnowledgeDocumentStatus;
      audience?: KnowledgeAudience;
      importance?: KnowledgeImportance;
      summary?: string | null;
      content?: string;
      tags?: string[] | null;
      createdByEmployeeId?: string | null;
      metadata?: Record<string, unknown> | null;
    } | null;
    if (!body?.saasId || !body.title || !body.type || !body.status || !body.content) {
      return NextResponse.json(
        { code: "INVALID_BODY", message: "saasId, title, type, status and content are required" },
        { status: 400 },
      );
    }
    if (body.audience && !AUDIENCE_VALUES.includes(body.audience)) {
      return NextResponse.json({ code: "INVALID_BODY", message: "audience no es válido" }, { status: 400 });
    }
    if (body.importance && !IMPORTANCE_VALUES.includes(body.importance)) {
      return NextResponse.json({ code: "INVALID_BODY", message: "importance no es válido" }, { status: 400 });
    }
    const { tenantId } = await requireTenantAccess(request);
    const ctx = await resolveKnowledgeContext({ tenantId, saasId: body.saasId });
    const document = await createKnowledgeDocument(ctx, {
      saasId: body.saasId,
      spaceId: body.spaceId ?? null,
      title: body.title,
      type: body.type,
      source: body.source ?? "MANUAL_OWNER",
      status: body.status,
      audience: body.audience,
      importance: body.importance,
      summary: body.summary ?? null,
      content: body.content,
      tags: body.tags ?? null,
      createdByEmployeeId: body.createdByEmployeeId ?? null,
      metadata: body.metadata ?? null,
    });
    return NextResponse.json({ document });
  } catch (error) {
    return handleKnowledgeApiError("KNOWLEDGE_DOCUMENTS_CREATE", error, "KNOWLEDGE_DOCUMENTS_CREATE_ERROR");
  }
}
