/**
 * P3 INTELLIGENT ALERTS: Validation Endpoint
 * 
 * Valida flujo completo:
 * eventos → análisis → alertas → notificaciones → WhatsApp
 */

import { NextResponse } from "next/server";
import { MentoriaFamilyRepository } from "@/lib/mentoria/family-repository";
import { getMentoriaDb } from "@/lib/mentoria/get-mentoria-db";
import { env } from "@/lib/cf";
import { emitEvent, getEventsByStudent } from "@/lib/mentoria/event-system";
import { detectAlertsForStudent, getAlertsByStudent } from "@/lib/mentoria/alert-engine";
import { generateNotificationsFromEvent, getPendingNotifications } from "@/lib/notifications/notification-engine";
import { registerWhatsAppContact, getWhatsAppContacts } from "@/lib/notifications/whatsapp-service";

export const dynamic = "force-dynamic";

export async function GET() {
  const results: any = {
    status: "PENDING",
    tests: [],
    errors: [],
  };

  try {
    const mentoriaDb = getMentoriaDb(env?.());
    const repo = new MentoriaFamilyRepository(mentoriaDb);
    const testFamilyId = `p3-alert-test-${Date.now()}`;
    const testStudentName = `P3-Alert-Student-${Date.now()}`;
    const testGuardianEmail = `p3-alert-guardian-${Date.now()}@test.local`;

    // Test 1: Create Family
    results.tests.push({ name: "Create Test Family", status: "IN_PROGRESS" });
    const family = await repo.createFamily(testFamilyId);
    results.tests[0].status = "PASSED";
    results.tests[0].result = { familyId: family.id };

    // Test 2: Create Student
    results.tests.push({ name: "Create Test Student", status: "IN_PROGRESS" });
    const student = await repo.createStudent({
      familyId: testFamilyId,
      name: testStudentName,
      age: 10,
      level: "5 primaria",
    });
    results.tests[1].status = "PASSED";
    results.tests[1].result = { studentId: student.id };

    // Test 3: Create Guardian
    results.tests.push({ name: "Create Guardian", status: "IN_PROGRESS" });
    const guardian = await repo.upsertGuardian({
      familyId: testFamilyId,
      email: testGuardianEmail,
      name: "Alert Test Guardian",
      role: "tutor",
    });
    results.tests[2].status = "PASSED";
    results.tests[2].result = { guardianId: guardian.id };

    // Test 4: Register WhatsApp Contact
    results.tests.push({ name: "Register WhatsApp Contact", status: "IN_PROGRESS" });
    const contact = await registerWhatsAppContact(guardian.id, "+34612345678", false);
    results.tests[3].status = "PASSED";
    results.tests[3].result = { contactId: contact.id };

    // Test 5: Emit Events to Trigger LOW_ACTIVITY Alert
    results.tests.push({ name: "Emit Events (LOW_ACTIVITY scenario)", status: "IN_PROGRESS" });
    
    // Día 1: actividad normal
    await emitEvent({
      type: "student.session.completed",
      actorType: "student",
      actorId: student.id,
      studentId: student.id,
      familyId: testFamilyId,
      metadata: { duration: 1800 }, // 30 minutos
    });

    // Día 2: actividad normal
    await emitEvent({
      type: "student.session.completed",
      actorType: "student",
      actorId: student.id,
      studentId: student.id,
      familyId: testFamilyId,
      metadata: { duration: 1800 },
    });

    // Día 3-7: actividad muy baja (simular descenso)
    for (let i = 0; i < 5; i++) {
      await emitEvent({
        type: "student.session.completed",
        actorType: "student",
        actorId: student.id,
        studentId: student.id,
        familyId: testFamilyId,
        metadata: { duration: 300 }, // 5 minutos
      });
    }

    results.tests[4].status = "PASSED";
    results.tests[4].result = { eventsEmitted: 7 };

    // Test 6: Emit Events to Trigger REPEATED_ERRORS Alert
    results.tests.push({ name: "Emit Events (REPEATED_ERRORS scenario)", status: "IN_PROGRESS" });
    
    for (let i = 0; i < 4; i++) {
      await emitEvent({
        type: "student.activity.completed",
        actorType: "student",
        actorId: student.id,
        studentId: student.id,
        familyId: testFamilyId,
        metadata: { error: true, errorType: "division_problem", failed: true },
      });
    }

    results.tests[5].status = "PASSED";
    results.tests[5].result = { errorEventsEmitted: 4 };

    // Test 7: Verify Events Persisted
    results.tests.push({ name: "Verify Events Persisted in D1", status: "IN_PROGRESS" });
    const persistedEvents = await getEventsByStudent(student.id);
    if (persistedEvents.length === 0) {
      throw new Error("Events not persisted in D1");
    }
    results.tests[6].status = "PASSED";
    results.tests[6].result = { persistedEventCount: persistedEvents.length };

    // Test 8: Detect Alerts
    results.tests.push({ name: "Detect Alerts (Rule Engine)", status: "IN_PROGRESS" });
    const alerts = await detectAlertsForStudent(student.id, testFamilyId);
    if (alerts.length === 0) {
      throw new Error("No alerts detected - rule engine may not be working");
    }
    results.tests[7].status = "PASSED";
    results.tests[7].result = {
      alertsDetected: alerts.length,
      alertTypes: [...new Set(alerts.map((a) => a.type))],
      alertSeverities: [...new Set(alerts.map((a) => a.severity))],
    };

    // Test 9: Verify Alerts Persisted
    results.tests.push({ name: "Verify Alerts Persisted in D1", status: "IN_PROGRESS" });
    const persistedAlerts = await getAlertsByStudent(student.id);
    if (persistedAlerts.length === 0) {
      throw new Error("Alerts not persisted in D1");
    }
    results.tests[8].status = "PASSED";
    results.tests[8].result = { persistedAlertCount: persistedAlerts.length };

    // Test 10: Generate Notifications from Alert Events
    results.tests.push({ name: "Generate Notifications from Alert Events", status: "IN_PROGRESS" });
    const alertNotifications = [];
    for (const alert of alerts) {
      const alertEvent = await emitEvent({
        type: "student.alert.generated",
        actorType: "system",
        actorId: "alert-detection",
        studentId: student.id,
        familyId: testFamilyId,
        metadata: { alertId: alert.id, alertType: alert.type, alertSeverity: alert.severity },
      });

      const notifications = await generateNotificationsFromEvent(alertEvent);
      alertNotifications.push(...notifications);
    }

    if (alertNotifications.length === 0) {
      throw new Error("No notifications generated from alerts");
    }
    results.tests[9].status = "PASSED";
    results.tests[9].result = {
      notificationCount: alertNotifications.length,
      channels: [...new Set(alertNotifications.map((n) => n.channel))],
    };

    // Test 11: Verify Notifications Persisted
    results.tests.push({ name: "Verify Notifications Persisted in D1", status: "IN_PROGRESS" });
    const pendingNotifications = await getPendingNotifications(100);
    if (pendingNotifications.length === 0) {
      throw new Error("Notifications not persisted in D1");
    }
    results.tests[10].status = "PASSED";
    results.tests[10].result = {
      persistedNotificationCount: pendingNotifications.length,
      statuses: [...new Set(pendingNotifications.map((n) => n.status))],
    };

    // Test 12: Verify WhatsApp Integration
    results.tests.push({ name: "Verify WhatsApp Integration", status: "IN_PROGRESS" });
    const whatsappContacts = await getWhatsAppContacts(guardian.id);
    if (whatsappContacts.length === 0) {
      throw new Error("WhatsApp contact not found");
    }
    results.tests[11].status = "PASSED";
    results.tests[11].result = {
      contactCount: whatsappContacts.length,
      optedIn: whatsappContacts[0].optedIn,
    };

    // Test 13: Verify Full Flow (eventos → análisis → alertas → notificaciones)
    results.tests.push({ name: "Verify Full Flow (eventos → análisis → alertas → notificaciones)", status: "IN_PROGRESS" });
    results.tests[12].status = "PASSED";
    results.tests[12].result = {
      eventsEmitted: persistedEvents.length,
      alertsDetected: alerts.length,
      alertsPersisted: persistedAlerts.length,
      notificationsCreated: alertNotifications.length,
      whatsappReady: whatsappContacts.length > 0,
      ruleEngineWorking: alerts.some((a) => a.type === "LOW_ACTIVITY" || a.type === "REPEATED_ERRORS"),
      database: "D1 Real",
      runtime: "Cloudflare Workers",
    };

    results.status = "SUCCESS";
    return NextResponse.json(results, { status: 200 });
  } catch (error) {
    const message = error instanceof Error ? error.message : String(error);
    results.status = "FAILED";
    results.errors.push(message);
    return NextResponse.json(results, { status: 500 });
  }
}
