import { requireCurrentSocialFlowSession } from "@/lib/socialflow/auth/request";
import { getDb } from "@/lib/db";
import { listProspects, bulkInsertProspects } from "@/lib/socialflow/prospector/repository";
import type { ProspectStatus } from "@/lib/socialflow/prospector/types";

export const dynamic = "force-dynamic";

export async function GET(request: Request) {
  try {
    const session = await requireCurrentSocialFlowSession(request);
    const url = new URL(request.url);
    const campaignId = url.searchParams.get("campaignId") ?? undefined;
    const status = (url.searchParams.get("status") ?? undefined) as ProspectStatus | undefined;
    const limitRaw = url.searchParams.get("limit");
    const limit = limitRaw ? Math.min(Math.max(parseInt(limitRaw, 10) || 100, 1), 500) : 100;

    const db = getDb(request);
    const prospects = await listProspects(db, session.tenantId, { campaignId, status, limit });

    return new Response(JSON.stringify({ ok: true, prospects }), {
      status: 200, headers: { "content-type": "application/json" },
    });
  } catch (e) {
    if (e instanceof Error && e.message === "SESSION_REQUIRED")
      return new Response(JSON.stringify({ error: "SESSION_REQUIRED" }), { status: 401, headers: { "content-type": "application/json" } });
    console.error("[prospector/prospects GET]", e);
    return new Response(JSON.stringify({ error: "INTERNAL_ERROR" }), { status: 500, headers: { "content-type": "application/json" } });
  }
}

// POST permite añadir prospectos manualmente (sin campaña de descubrimiento)
export async function POST(request: Request) {
  try {
    const session = await requireCurrentSocialFlowSession(request);
    const body = (await request.json()) as {
      prospects?: Array<{
        businessName: string;
        email?: string;
        phone?: string;
        whatsapp?: string;
        website?: string;
        instagramHandle?: string;
        niche?: string;
        location?: string;
        description?: string;
        campaignId?: string;
      }>;
      saasId?: string;
    };

    if (!Array.isArray(body.prospects) || body.prospects.length === 0) {
      return new Response(JSON.stringify({ error: "PROSPECTS_REQUIRED" }), {
        status: 400, headers: { "content-type": "application/json" },
      });
    }

    const saasId = body.saasId?.trim() || "socialflow";
    const db = getDb(request);

    const toInsert = body.prospects.map((p) => ({
      tenantId: session.tenantId,
      saasId,
      campaignId: p.campaignId ?? null,
      businessName: p.businessName,
      contactName: null,
      email: p.email ?? null,
      phone: p.phone ?? null,
      whatsapp: p.whatsapp ?? p.phone ?? null,
      website: p.website ?? null,
      instagramHandle: p.instagramHandle ?? null,
      niche: p.niche ?? "general",
      location: p.location ?? "",
      description: p.description ?? null,
      source: "MANUAL" as const,
      rating: null,
      reviewCount: null,
      notes: null,
    }));

    const created = await bulkInsertProspects(db, toInsert);

    return new Response(JSON.stringify({ ok: true, created: created.length, prospects: created }), {
      status: 201, headers: { "content-type": "application/json" },
    });
  } catch (e) {
    if (e instanceof Error && e.message === "SESSION_REQUIRED")
      return new Response(JSON.stringify({ error: "SESSION_REQUIRED" }), { status: 401, headers: { "content-type": "application/json" } });
    console.error("[prospector/prospects POST]", e);
    return new Response(JSON.stringify({ error: "INTERNAL_ERROR" }), { status: 500, headers: { "content-type": "application/json" } });
  }
}
