/**
 * P1 PRODUCT REAL: Events Endpoint
 * 
 * GET /api/events - Obtiene eventos
 * POST /api/events - Emite nuevo evento
 */

import { NextRequest, NextResponse } from "next/server";
import { emitEvent, getEventsByStudent, getEventsByFamily, getEventsByType } from "@/lib/mentoria/event-system";
import { generateNotificationsFromEvent } from "@/lib/notifications/notification-engine";

export const dynamic = "force-dynamic";

export async function GET(request: NextRequest) {
  try {
    const { searchParams } = new URL(request.url);
    const studentId = searchParams.get("studentId");
    const familyId = searchParams.get("familyId");
    const type = searchParams.get("type");
    const limit = parseInt(searchParams.get("limit") || "50", 10);

    let events;

    if (studentId) {
      events = await getEventsByStudent(studentId, limit);
    } else if (familyId) {
      events = await getEventsByFamily(familyId, limit);
    } else if (type) {
      events = await getEventsByType(type as any, limit);
    } else {
      return NextResponse.json(
        { error: "Must provide studentId, familyId, or type" },
        { status: 400 }
      );
    }

    return NextResponse.json({ events }, { status: 200 });
  } catch (error) {
    const message = error instanceof Error ? error.message : String(error);
    return NextResponse.json({ error: message }, { status: 500 });
  }
}

export async function POST(request: NextRequest) {
  try {
    const body = await request.json();
    const { type, actorType, actorId, studentId, familyId, metadata } = body;

    if (!type || !actorType || !actorId) {
      return NextResponse.json(
        { error: "Missing required fields: type, actorType, actorId" },
        { status: 400 }
      );
    }

    // Emitir evento
    const event = await emitEvent({
      type,
      actorType,
      actorId,
      studentId,
      familyId,
      metadata,
    });

    // Generar notificaciones automáticamente
    const notifications = await generateNotificationsFromEvent(event);

    return NextResponse.json(
      { event, notifications },
      { status: 201 }
    );
  } catch (error) {
    const message = error instanceof Error ? error.message : String(error);
    return NextResponse.json({ error: message }, { status: 500 });
  }
}
