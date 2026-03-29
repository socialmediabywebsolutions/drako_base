/**
 * P2 INTELLIGENT SUMMARIES: Run Daily Summaries
 * 
 * Endpoint: /api/internal/run-daily-summaries
 * 
 * Ejecuta resúmenes diarios para todos los estudiantes activos
 * (Será llamado por Cloudflare Cron Triggers en producción)
 * 
 * Flujo:
 * 1. Obtener estudiantes activos (con eventos en últimas 24h)
 * 2. Generar resumen diario para cada uno
 * 3. Crear notificaciones automáticas
 * 4. Enviar a WhatsApp
 */

import { NextResponse } from "next/server";
import { getDb } from "@/lib/db";
import { generateDailySummary, getSummariesByStudent } from "@/lib/mentoria/summary-engine";
import { emitEvent, getEventsByStudent } from "@/lib/mentoria/event-system";
import { generateNotificationsFromEvent, getPendingNotifications, markNotificationAsSent } from "@/lib/notifications/notification-engine";
import { getWhatsAppContacts, WhatsAppService } from "@/lib/notifications/whatsapp-service";
import { MentoriaFamilyRepository } from "@/lib/mentoria/family-repository";

export const dynamic = "force-dynamic";

export async function POST() {
  const results: any = {
    status: "PENDING",
    studentsProcessed: 0,
    summariesGenerated: 0,
    notificationsCreated: 0,
    whatsappSent: 0,
    errors: [],
  };

  try {
    const db = getDb();
    const repo = new MentoriaFamilyRepository();

    // 1. Obtener estudiantes activos (con eventos en últimas 24h)
    const cutoffTime = new Date(Date.now() - 24 * 60 * 60 * 1000).toISOString();

    const activeStudentsResult = await db
      .prepare(
        `SELECT DISTINCT student_id, family_id
         FROM events
         WHERE created_at >= ? AND student_id IS NOT NULL
         GROUP BY student_id, family_id`
      )
      .bind(cutoffTime)
      .all<any>();

    const activeStudents = activeStudentsResult.results ?? [];
    results.studentsProcessed = activeStudents.length;

    // 2. Generar resumen para cada estudiante
    for (const record of activeStudents) {
      try {
        const { student_id: studentId, family_id: familyId } = record;

        // Obtener datos del estudiante
        const student = await repo.getStudentById(studentId);
        if (!student) continue;

        // Generar resumen diario
        const summary = await generateDailySummary(studentId, familyId, student.name);
        results.summariesGenerated++;

        // Emitir evento de resumen generado
        const event = await emitEvent({
          type: "student.summary.generated",
          actorType: "system",
          actorId: "daily-summary-job",
          studentId,
          familyId,
          metadata: {
            summaryId: summary.id,
            summaryType: "daily",
            content: summary.content,
          },
        });

        // Generar notificaciones automáticamente
        const notifications = await generateNotificationsFromEvent(event);
        results.notificationsCreated += notifications.length;

        // 3. Intentar enviar por WhatsApp
        const whatsappNotifications = notifications.filter((n) => n.channel === "whatsapp");

        for (const notification of whatsappNotifications) {
          try {
            // Obtener contactos WhatsApp del guardián
            const contacts = await getWhatsAppContacts(notification.targetId);

            if (contacts.length > 0 && contacts[0].optedIn) {
              // Crear servicio WhatsApp (mock en desarrollo)
              const whatsappService = new WhatsAppService({
                provider: "mock", // En producción: "twilio" o "meta"
                apiKey: process.env.WHATSAPP_API_KEY || "test-key",
              });

              // Enviar mensaje
              const result = await whatsappService.sendMessage({
                to: contacts[0].phoneNumber,
                body: `📚 Resumen de hoy:\n\n${summary.content}`,
              });

              // Marcar como enviada
              await markNotificationAsSent(notification.id);
              results.whatsappSent++;
            }
          } catch (error) {
            const msg = error instanceof Error ? error.message : String(error);
            results.errors.push(`WhatsApp send error for notification ${notification.id}: ${msg}`);
          }
        }
      } catch (error) {
        const msg = error instanceof Error ? error.message : String(error);
        results.errors.push(`Error processing student ${record.student_id}: ${msg}`);
      }
    }

    results.status = "SUCCESS";
    return NextResponse.json(results, { status: 200 });
  } catch (error) {
    const message = error instanceof Error ? error.message : String(error);
    results.status = "FAILED";
    results.errors.push(message);
    return NextResponse.json(results, { status: 500 });
  }
}

export async function GET() {
  return NextResponse.json(
    { message: "Use POST to run daily summaries" },
    { status: 405 }
  );
}
