/**
 * P4 PARENT EXPERIENCE: Parent Overview Endpoint
 * 
 * GET /api/parent/overview?studentId=...&familyId=...
 * 
 * Carga datos reales desde D1 para la experiencia del padre:
 * - Último resumen (summary)
 * - Alertas activas
 * - Historial reciente
 * - Datos básicos del estudiante
 */

import { NextRequest, NextResponse } from "next/server";
import { MentoriaFamilyRepository } from "@/lib/mentoria/family-repository";
import { getMentoriaDb } from "@/lib/mentoria/get-mentoria-db";
import { env } from "@/lib/cf";
import { getSummariesByStudent } from "@/lib/mentoria/summary-engine";
import { getAlertsByStudent } from "@/lib/mentoria/alert-engine";
import { getEventsByStudent } from "@/lib/mentoria/event-system";

export const dynamic = "force-dynamic";

export async function GET(request: NextRequest) {
  try {
    const { searchParams } = new URL(request.url);
    const studentId = searchParams.get("studentId");
    const familyId = searchParams.get("familyId");

    if (!studentId || !familyId) {
      return NextResponse.json(
        { error: "Missing required parameters: studentId, familyId" },
        { status: 400 }
      );
    }

    const mentoriaDb = getMentoriaDb(env?.());
    const repo = new MentoriaFamilyRepository(mentoriaDb);

    // 1. Obtener datos del estudiante
    const student = await repo.getStudentById(studentId);
    if (!student) {
      return NextResponse.json(
        { error: "Student not found" },
        { status: 404 }
      );
    }

    // 2. Obtener último resumen (daily)
    const summaries = await getSummariesByStudent(studentId, 1);
    const latestSummary = summaries[0] || null;

    // 3. Obtener alertas activas (no resueltas)
    const allAlerts = await getAlertsByStudent(studentId, 100);
    const activeAlerts = allAlerts.filter((a) => !a.resolved);

    // 4. Obtener historial de resúmenes (últimos 5)
    const summaryHistory = await getSummariesByStudent(studentId, 5);

    // 5. Obtener eventos recientes (últimos 10)
    const recentEvents = await getEventsByStudent(studentId, 10);

    // 6. Calcular estadísticas básicas
    const stats = {
      totalActivitiesThisWeek: recentEvents.filter(
        (e) => e.type === "student.activity.completed"
      ).length,
      totalSessionsThisWeek: recentEvents.filter(
        (e) => e.type === "student.session.completed"
      ).length,
      lastActivityTime: recentEvents[0]?.createdAt || null,
    };

    return NextResponse.json(
      {
        student: {
          id: student.id,
          name: student.name,
          age: student.age,
          level: student.level,
        },
        latestSummary: latestSummary
          ? {
              id: latestSummary.id,
              type: latestSummary.type,
              content: latestSummary.content,
              createdAt: latestSummary.createdAt,
            }
          : null,
        alerts: activeAlerts.map((a) => ({
          id: a.id,
          type: a.type,
          severity: a.severity,
          message: a.message,
          createdAt: a.createdAt,
        })),
        summaryHistory: summaryHistory.map((s) => ({
          id: s.id,
          type: s.type,
          content: s.content,
          createdAt: s.createdAt,
        })),
        stats,
        lastUpdated: new Date().toISOString(),
      },
      { status: 200 }
    );
  } catch (error) {
    const message = error instanceof Error ? error.message : String(error);
    return NextResponse.json({ error: message }, { status: 500 });
  }
}
