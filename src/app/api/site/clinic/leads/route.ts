import { NextResponse } from "next/server";
import { resolveClinicContext, NoActiveClinicSubscriptionError } from "@/lib/clinic/context";
import { saveClinicLead } from "@/lib/clinic/repository";
import { findSaasBySlug } from "@/lib/site/clinic";
import { enforcePublicEndpointPolicy } from "@/lib/security/public-endpoints";
import { registerPublicIngestFailure, verifyPublicIngestAccess } from "@/lib/security/public-ingest";


export async function POST(request: Request) {
  try {
    const blocked = await enforcePublicEndpointPolicy({ request, route: "/api/site/clinic/leads" });
    if (blocked) return blocked;

    const rawBody = await request.text();
    const body = (() => {
      try {
        return rawBody ? JSON.parse(rawBody) : null;
      } catch {
        return null;
      }
    })() as {
      slug?: string;
      name?: string;
      email?: string | null;
      phone?: string | null;
      service?: string | null;
      message?: string | null;
    } | null;
    if (!body?.slug || !body.name) {
      return NextResponse.json({ ok: false, error: "slug and name are required" }, { status: 400 });
    }

    const saas = await findSaasBySlug(body.slug);
    if (!saas) {
      return NextResponse.json({ ok: false, error: "Clinic not found" }, { status: 404 });
    }

    const correlationId =
      request.headers.get("x-drako-correlation-id") ||
      globalThis.crypto?.randomUUID?.() ||
      `corr_${Date.now()}_${Math.random().toString(16).slice(2, 10)}`;

    const verification = await verifyPublicIngestAccess({
      request,
      tenantId: saas.tenantId,
      saasId: saas.saasId,
      bodyText: rawBody,
    });

    if (!verification.ok) {
      await registerPublicIngestFailure({
        request,
        tenantId: saas.tenantId,
        saasId: saas.saasId,
        saasSlug: body.slug,
        route: "/api/site/clinic/leads",
        reason: verification.reason ?? "invalid_signature",
        correlationId,
      });
      return NextResponse.json(
        { ok: false, error: verification.error ?? "INVALID_SIGNATURE" },
        { status: verification.status ?? 401 },
      );
    }

    const context = await resolveClinicContext(saas.tenantId, saas.saasId);
    await saveClinicLead(context, {
      saasId: context.saasId,
      name: body.name.trim(),
      email: body.email?.trim() || null,
      phone: body.phone?.trim() || null,
      source: "public_site",
      interest: body.service?.trim() || null,
      notes: body.message?.trim() || null,
      priority: "medium",
      status: "new",
    });

    return NextResponse.json({ ok: true });
  } catch (error) {
    if (error instanceof NoActiveClinicSubscriptionError) {
      return NextResponse.json(
        { ok: false, error: "Clinic is not active right now" },
        { status: 403 },
      );
    }
    console.error("PUBLIC_CLINIC_LEAD_ERROR", error);
    return NextResponse.json(
      { ok: false, error: "No se pudo registrar el lead público" },
      { status: 500 },
    );
  }
}
