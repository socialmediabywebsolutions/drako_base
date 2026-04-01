/**
 * Campamento Base: Supervisor Incidents API
 * 
 * POST /api/campamento-base/supervisor/incidents - Ingestar incidente técnico
 * GET /api/campamento-base/supervisor/incidents - Listar incidentes
 */

import { NextRequest, NextResponse } from "next/server";
import { IncidentService } from "@/lib/supervisor";
import type { IncidentPayload, IncidentQueryFilter, IncidentSource, ServiceSurface } from "@/lib/supervisor";

export const dynamic = "force-dynamic";

const incidentService = new IncidentService();

/**
 * POST: Ingestar nuevo incidente técnico
 */
export async function POST(request: NextRequest) {
  try {
    const body = (await request.json()) as Record<string, unknown>;

    // Validar campos requeridos
    if (!body.source || !body.title || !body.description) {
      return NextResponse.json(
        { error: "source, title, and description are required" },
        { status: 400 }
      );
    }

    const payload: IncidentPayload = {
      source: body.source as IncidentSource,
      title: body.title as string,
      description: body.description as string,
      metadata: body.metadata as Record<string, unknown> | undefined,
      correlationId: body.correlationId as string | undefined,
      affectedService: body.affectedService as ServiceSurface | undefined,
    };

    const result = await incidentService.ingestIncident(payload);

    return NextResponse.json(result, { status: 201 });
  } catch (error) {
    console.error("[supervisor/incidents POST]", error);
    return NextResponse.json(
      { error: "Failed to ingest incident" },
      { status: 500 }
    );
  }
}

/**
 * GET: Listar incidentes con filtros opcionales
 */
export async function GET(request: NextRequest) {
  try {
    const searchParams = request.nextUrl.searchParams;

    const filter: IncidentQueryFilter = {
      status: (searchParams.get("status") as any) || undefined,
      severity: (searchParams.get("severity") as any) || undefined,
      category: (searchParams.get("category") as any) || undefined,
      source: (searchParams.get("source") as any) || undefined,
      affectedService: (searchParams.get("affectedService") as any) || undefined,
      createdAfter: searchParams.get("createdAfter") || undefined,
      createdBefore: searchParams.get("createdBefore") || undefined,
      limit: searchParams.get("limit") ? parseInt(searchParams.get("limit")!) : 50,
      offset: searchParams.get("offset") ? parseInt(searchParams.get("offset")!) : 0,
    };

    const incidents = await incidentService.listIncidents(filter);

    return NextResponse.json({ incidents, count: incidents.length });
  } catch (error) {
    console.error("[supervisor/incidents GET]", error);
    return NextResponse.json(
      { error: "Failed to list incidents" },
      { status: 500 }
    );
  }
}
