import { NextResponse } from "next/server";
import { requireTenantAccess } from "@/lib/auth/session";
import { handleKnowledgeApiError } from "@/lib/knowledge/api-helpers";
import { createKnowledgeSpace, listKnowledgeSpaces, resolveKnowledgeContext } from "@/lib/knowledge/repository";

export const runtime = "edge";

export async function GET(request: Request) {
  try {
    const url = new URL(request.url);
    const saasId = url.searchParams.get("saasId");
    if (!saasId) {
      return NextResponse.json({ code: "INVALID_PARAMS", message: "saasId is required" }, { status: 400 });
    }
    const { tenantId } = await requireTenantAccess(request);
    const ctx = await resolveKnowledgeContext({ tenantId, saasId });
    const spaces = await listKnowledgeSpaces(ctx);
    return NextResponse.json({ spaces, count: spaces.length });
  } catch (error) {
    return handleKnowledgeApiError("KNOWLEDGE_SPACES_LIST", error, "KNOWLEDGE_SPACES_ERROR");
  }
}

export async function POST(request: Request) {
  try {
    const body = (await request.json().catch(() => null)) as {
      saasId?: string | null;
      slug?: string;
      label?: string;
      description?: string | null;
      isActive?: boolean;
    } | null;
    if (!body?.saasId || !body.slug || !body.label) {
      return NextResponse.json(
        { code: "INVALID_BODY", message: "saasId, slug and label are required" },
        { status: 400 },
      );
    }
    const { tenantId } = await requireTenantAccess(request);
    const ctx = await resolveKnowledgeContext({ tenantId, saasId: body.saasId });
    const space = await createKnowledgeSpace(ctx, {
      saasId: body.saasId,
      slug: body.slug,
      label: body.label,
      description: body.description ?? null,
      isActive: typeof body.isActive === "boolean" ? body.isActive : true,
    });
    return NextResponse.json({ space });
  } catch (error) {
    return handleKnowledgeApiError("KNOWLEDGE_SPACES_CREATE", error, "KNOWLEDGE_SPACES_CREATE_ERROR");
  }
}
