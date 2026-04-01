/**
 * Campamento Base: Supervisor Critical Incidents API
 * 
 * GET /api/campamento-base/supervisor/critical - Obtener incidentes críticos abiertos
 */

import { NextRequest, NextResponse } from "next/server";
import { IncidentService } from "@/lib/supervisor";

export const dynamic = "force-dynamic";

const incidentService = new IncidentService();

/**
 * GET: Obtener incidentes críticos abiertos
 */
export async function GET(request: NextRequest) {
  try {
    const incidents = await incidentService.getCriticalOpenIncidents();

    return NextResponse.json({
      incidents,
      count: incidents.length,
      timestamp: new Date().toISOString(),
    });
  } catch (error) {
    console.error("[supervisor/critical GET]", error);
    return NextResponse.json(
      { error: "Failed to fetch critical incidents" },
      { status: 500 }
    );
  }
}
