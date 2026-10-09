export const dynamic = "force-dynamic";

import { NextResponse } from "next/server";
import { requireCurrentSocialFlowSession } from "@/lib/socialflow/auth/request";
import { isActiveSocialFlowTrial } from "@/lib/socialflow/billing/enforce";

// Único punto donde el cliente (navegador) puede saber si debe aplicar la marca de agua
// de trial en el compositing client-side (StaticSlideRenderer — carrusel/foto única).
// isActiveSocialFlowTrial ya vive en varias rutas server-side (generate-ai-carousel,
// campaigns/[id]/photos, generate-from-image) pero solo internamente, para
// MAX_POSTS_PER_DAY — nunca se devolvía al cliente. En vez de tocar 3+ rutas
// existentes, un endpoint dedicado y reutilizable.
export async function GET(request: Request) {
  try {
    const session = await requireCurrentSocialFlowSession(request);
    const isTrial = await isActiveSocialFlowTrial(session.tenantId, session.role);
    return NextResponse.json({ isTrial });
  } catch (error) {
    if (error instanceof Error && error.message === "SESSION_REQUIRED") {
      return NextResponse.json({ code: "UNAUTHORIZED", message: "SESSION_REQUIRED" }, { status: 401 });
    }
    console.error("SOCIALFLOW_TRIAL_STATUS_ERROR", error);
    return NextResponse.json({ code: "SOCIALFLOW_ERROR", message: "Unable to resolve trial status" }, { status: 500 });
  }
}
