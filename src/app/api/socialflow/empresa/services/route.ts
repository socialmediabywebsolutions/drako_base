export const dynamic = "force-dynamic";

import { NextResponse } from "next/server";
import { requireCurrentSocialFlowSession } from "@/lib/socialflow/auth/request";
import { getServicesByTenant, createService } from "@/lib/socialflow/services/repository";

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
    const services = await getServicesByTenant(session.tenantId, resolveSaasId(req));
    return NextResponse.json({ ok: true, services });
  } catch (err) {
    console.error("[Services] list failed", err instanceof Error ? err.message : String(err));
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
    description?: string;
    category?: string;
    active?: boolean;
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
    const service = await createService(session.tenantId, resolveSaasId(req), {
      name,
      description: body.description?.trim() || null,
      category: body.category?.trim() || null,
      active: body.active,
    });
    return NextResponse.json({ ok: true, service });
  } catch (err) {
    console.error("[Services] create failed", err instanceof Error ? err.message : String(err));
    return NextResponse.json({ error: "CREATE_FAILED" }, { status: 500 });
  }
}
