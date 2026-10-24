/**
 * P2 INTELLIGENT SUMMARIES: Summaries Endpoint
 * 
 * GET /api/summaries - Obtiene resúmenes
 * POST /api/summaries - Genera resumen manual
 */

import { NextRequest, NextResponse } from "next/server";
import { getSummariesByStudent, getSummariesByFamily, generateDailySummary, generateWeeklySummary } from "@/lib/mentoria/summary-engine";
import { MentoriaFamilyRepository } from "@/lib/mentoria/family-repository";
import { generateNotificationsFromEvent, emitEvent } from "@/lib/mentoria/event-system";

export const dynamic = "force-dynamic";

export async function GET(request: NextRequest) {
  try {
    const { searchParams } = new URL(request.url);
    const studentId = searchParams.get("studentId");
    const familyId = searchParams.get("familyId");
    const limit = parseInt(searchParams.get("limit") || "30", 10);

    let summaries;

    if (studentId) {
      summaries = await getSummariesByStudent(studentId, limit);
    } else if (familyId) {
      summaries = await getSummariesByFamily(familyId, limit);
    } else {
      return NextResponse.json(
        { error: "Must provide studentId or familyId" },
        { status: 400 }
      );
    }

    return NextResponse.json({ summaries }, { status: 200 });
  } catch (error) {
    const message = error instanceof Error ? error.message : String(error);
    return NextResponse.json({ error: message }, { status: 500 });
  }
}

export async function POST(request: NextRequest) {
  try {
    const body = (await request.json()) as {
      studentId?: string;
      familyId?: string;
      type?: string;
      studentName?: string;
    };
    const { studentId, familyId, type = "daily", studentName } = body;

    if (!studentId || !familyId) {
      return NextResponse.json(
        { error: "Missing required fields: studentId, familyId" },
        { status: 400 }
      );
    }

    let summary;

    if (type === "daily") {
      summary = await generateDailySummary(studentId, familyId, studentName || "tu hijo");
    } else if (type === "weekly") {
      summary = await generateWeeklySummary(studentId, familyId, studentName || "tu hijo");
    } else {
      return NextResponse.json(
        { error: "Invalid summary type. Must be 'daily' or 'weekly'" },
        { status: 400 }
      );
    }

    // Emitir evento de resumen generado
    const event = await emitEvent({
      type: "student.summary.generated",
      actorType: "system",
      actorId: "summary-engine",
      studentId,
      familyId,
      metadata: {
        summaryId: summary.id,
        summaryType: type,
      },
    });

    // Generar notificaciones automáticamente
    const notifications = await generateNotificationsFromEvent(event);

    return NextResponse.json(
      { summary, event, notifications },
      { status: 201 }
    );
  } catch (error) {
    const message = error instanceof Error ? error.message : String(error);
    return NextResponse.json({ error: message }, { status: 500 });
  }
}
