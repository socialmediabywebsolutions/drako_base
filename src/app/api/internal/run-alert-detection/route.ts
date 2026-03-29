/**
 * P3 INTELLIGENT ALERTS: Run Alert Detection
 * 
 * Endpoint: /api/internal/run-alert-detection
 * 
 * Ejecuta detección de alertas para todos los estudiantes
 * (Será llamado por Cloudflare Cron Triggers en producción)
 * 
 * Flujo:
 * 1. Obtener estudiantes activos
 * 2. Ejecutar detectAlertsForStudent() para cada uno
 * 3. Generar eventos de alerta
 * 4. Crear notificaciones automáticas
 * 5. Enviar a WhatsApp
 */

import { NextResponse } from "next/server";
import { getDb } from "@/lib/db";
import { detectAlertsForStudent } from "@/lib/mentoria/alert-engine";
import { emitEvent } from "@/lib/mentoria/event-system";
import { generateNotificationsFromEvent, getPendingNotifications, markNotificationAsSent } from "@/lib/notifications/notification-engine";
import { getWhatsAppContacts, WhatsAppService } from "@/lib/notifications/whatsapp-service";
import { MentoriaFamilyRepository } from "@/lib/mentoria/family-repository";

export const dynamic = "force-dynamic";

export async function POST() {
  const results: any = {
    status: "PENDING",
    studentsProcessed: 0,
    alertsGenerated: 0,
    notificationsCreated: 0,
    whatsappSent: 0,
    errors: [],
  };

  try {
    const db = getDb();
    const repo = new MentoriaFamilyRepository();

    // 1. Obtener estudiantes activos (con eventos en últimos 7 días)
    const cutoffTime = new Date(Date.now() - 7 * 24 * 60 * 60 * 1000).toISOString();

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

    // 2. Detectar alertas para cada estudiante
    for (const record of activeStudents) {
      try {
        const { student_id: studentId, family_id: familyId } = record;

        // Detectar alertas
        const alerts = await detectAlertsForStudent(studentId, familyId);

        if (alerts.length === 0) continue;

        results.alertsGenerated += alerts.length;

        // 3. Generar evento y notificaciones para cada alerta
        for (const alert of alerts) {
          try {
            // Emitir evento de alerta generada
            const event = await emitEvent({
              type: "student.alert.generated",
              actorType: "system",
              actorId: "alert-detection-job",
              studentId,
              familyId,
              metadata: {
                alertId: alert.id,
                alertType: alert.type,
                alertSeverity: alert.severity,
                alertMessage: alert.message,
              },
            });

            // Generar notificaciones automáticamente
            const notifications = await generateNotificationsFromEvent(event);
            results.notificationsCreated += notifications.length;

            // 4. Intentar enviar por WhatsApp
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
                    body: `⚠️ Alerta importante:\n\n${alert.message}`,
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
            results.errors.push(`Error processing alert ${alert.id}: ${msg}`);
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
    { message: "Use POST to run alert detection" },
    { status: 405 }
  );
}
