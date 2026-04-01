/**
 * Campamento Base: Supervisor Incident Details API
 * 
 * GET /api/campamento-base/supervisor/incidents/[id] - Obtener incidente + recomendaciones
 * PATCH /api/campamento-base/supervisor/incidents/[id] - Actualizar estado
 */

import { NextRequest, NextResponse } from "next/server";
import { IncidentService } from "@/lib/supervisor";

export const dynamic = "force-dynamic";

/**
 * GET: Obtener incidente específico con recomendaciones
 */
export async function GET(
  request: NextRequest,
  { params }: { params: { id: string } }
) {
  try {
    const incidentService = new IncidentService();
    const { id } = params;

    const result = await incidentService.getIncidentWithRecommendations(id);

    if (!result) {
      return NextResponse.json(
        { error: "Incident not found" },
        { status: 404 }
      );
    }

    return NextResponse.json(result);
  } catch (error) {
    console.error("[supervisor/incidents/[id] GET]", error);
    return NextResponse.json(
      { error: "Failed to fetch incident" },
      { status: 500 }
    );
  }
}

/**
 * PATCH: Actualizar estado del incidente
 */
export async function PATCH(
  request: NextRequest,
  { params }: { params: { id: string } }
) {
  try {
    const incidentService = new IncidentService();
    const { id } = params;
    const body = (await request.json()) as Record<string, unknown>;

    const status = body.status as "open" | "investigating" | "resolved" | "acknowledged" | "escalated";

    if (!status) {
      return NextResponse.json(
        { error: "Status is required" },
        { status: 400 }
      );
    }

    await incidentService.updateIncidentStatus(id, status);

    const result = await incidentService.getIncidentWithRecommendations(id);

    return NextResponse.json(result);
  } catch (error) {
    console.error("[supervisor/incidents/[id] PATCH]", error);
    return NextResponse.json(
      { error: "Failed to update incident" },
      { status: 500 }
    );
  }
}
