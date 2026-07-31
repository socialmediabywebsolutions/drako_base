export const dynamic = "force-dynamic";

import { NextResponse } from "next/server";
import { requireCurrentSocialFlowSession } from "@/lib/socialflow/auth/request";
import { getLocal, upsertLocal } from "@/lib/socialflow/local/repository";

const DEFAULT_SAAS_ID = "socialflow";

function resolveSaasId(request: Request): string {
  return new URL(request.url).searchParams.get("saasId")?.trim() || DEFAULT_SAAS_ID;
}

type LocalBody = {
  businessName?: string;
  address?: string;
  openingHours?: string;
  description?: string;
  niche?: string;
};

export async function GET(req: Request) {
  let session: Awaited<ReturnType<typeof requireCurrentSocialFlowSession>>;
  try {
    session = await requireCurrentSocialFlowSession(req);
  } catch {
    return NextResponse.json({ error: "SESSION_REQUIRED" }, { status: 401 });
  }

  try {
    const local = await getLocal(session.tenantId, resolveSaasId(req));
    return NextResponse.json({ ok: true, local });
  } catch (err) {
    console.error("[Local] get failed", err instanceof Error ? err.message : String(err));
    return NextResponse.json({ error: "GET_FAILED" }, { status: 500 });
  }
}

async function saveLocal(req: Request) {
  let session: Awaited<ReturnType<typeof requireCurrentSocialFlowSession>>;
  try {
    session = await requireCurrentSocialFlowSession(req);
  } catch {
    return NextResponse.json({ error: "SESSION_REQUIRED" }, { status: 401 });
  }

  let body: LocalBody;
  try {
    body = await req.json();
  } catch {
    return NextResponse.json({ error: "INVALID_BODY" }, { status: 400 });
  }

  try {
    const local = await upsertLocal(session.tenantId, resolveSaasId(req), {
      businessName: body.businessName?.trim() || null,
      address: body.address?.trim() || null,
      openingHours: body.openingHours?.trim() || null,
      description: body.description?.trim() || null,
      niche: body.niche?.trim() || null,
    });
    return NextResponse.json({ ok: true, local });
  } catch (err) {
    console.error("[Local] save failed", err instanceof Error ? err.message : String(err));
    return NextResponse.json({ error: "SAVE_FAILED" }, { status: 500 });
  }
}

export async function POST(req: Request) {
  return saveLocal(req);
}

export async function PATCH(req: Request) {
  return saveLocal(req);
}
