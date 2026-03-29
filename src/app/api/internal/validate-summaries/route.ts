/**
 * P2 INTELLIGENT SUMMARIES: Validation Endpoint
 * 
 * Valida flujo completo:
 * eventos → análisis IA → resumen → D1 → notificación → WhatsApp
 */

import { NextResponse } from "next/server";
import { MentoriaFamilyRepository } from "@/lib/mentoria/family-repository";
import { getMentoriaDb } from "@/lib/mentoria/get-mentoria-db";
import { env } from "@/lib/cf";
import { emitEvent, getEventsByStudent } from "@/lib/mentoria/event-system";
import { generateDailySummary, getSummariesByStudent } from "@/lib/mentoria/summary-engine";
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
    const testFamilyId = `p2-summary-test-${Date.now()}`;
    const testStudentName = `P2-Summary-Student-${Date.now()}`;
    const testGuardianEmail = `p2-summary-guardian-${Date.now()}@test.local`;

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
      age: 11,
      level: "5 primaria",
    });
    results.tests[1].status = "PASSED";
    results.tests[1].result = { studentId: student.id };

    // Test 3: Create Guardian
    results.tests.push({ name: "Create Guardian", status: "IN_PROGRESS" });
    const guardian = await repo.upsertGuardian({
      familyId: testFamilyId,
      email: testGuardianEmail,
      name: "Summary Test Guardian",
      role: "tutor",
    });
    results.tests[2].status = "PASSED";
    results.tests[2].result = { guardianId: guardian.id };

    // Test 4: Register WhatsApp Contact
    results.tests.push({ name: "Register WhatsApp Contact", status: "IN_PROGRESS" });
    const contact = await registerWhatsAppContact(guardian.id, "+34612345678", false);
    results.tests[3].status = "PASSED";
    results.tests[3].result = { contactId: contact.id };

    // Test 5: Emit Multiple Events (simulate real activity)
    results.tests.push({ name: "Emit Multiple Events", status: "IN_PROGRESS" });
    const events = [];
    
    // Session started
    events.push(
      await emitEvent({
        type: "student.session.started",
        actorType: "student",
        actorId: student.id,
        studentId: student.id,
        familyId: testFamilyId,
        metadata: { timestamp: new Date().toISOString() },
      })
    );

    // Activities completed
    for (let i = 0; i < 3; i++) {
      events.push(
        await emitEvent({
          type: "student.activity.completed",
          actorType: "student",
          actorId: student.id,
          studentId: student.id,
          familyId: testFamilyId,
          metadata: { activityId: `activity-${i}`, subject: "Matemáticas" },
        })
      );
    }

    // Session completed
    events.push(
      await emitEvent({
        type: "student.session.completed",
        actorType: "student",
        actorId: student.id,
        studentId: student.id,
        familyId: testFamilyId,
        metadata: { duration: 1800, activitiesCount: 3 },
      })
    );

    // Progress updated
    events.push(
      await emitEvent({
        type: "student.progress.updated",
        actorType: "system",
        actorId: "system",
        studentId: student.id,
        familyId: testFamilyId,
        metadata: { subject: "Matemáticas", score: 85, improvement: 5 },
      })
    );

    results.tests[4].status = "PASSED";
    results.tests[4].result = { eventsEmitted: events.length };

    // Test 6: Verify Events Persisted
    results.tests.push({ name: "Verify Events Persisted in D1", status: "IN_PROGRESS" });
    const persistedEvents = await getEventsByStudent(student.id);
    if (persistedEvents.length === 0) {
      throw new Error("Events not persisted in D1");
    }
    results.tests[5].status = "PASSED";
    results.tests[5].result = { persistedEventCount: persistedEvents.length };

    // Test 7: Generate Daily Summary (IA integration)
    results.tests.push({ name: "Generate Daily Summary (IA)", status: "IN_PROGRESS" });
    const summary = await generateDailySummary(student.id, testFamilyId, testStudentName);
    if (!summary.content || summary.content.length === 0) {
      throw new Error("Summary content is empty");
    }
    results.tests[6].status = "PASSED";
    results.tests[6].result = {
      summaryId: summary.id,
      contentLength: summary.content.length,
      contentPreview: summary.content.substring(0, 100),
    };

    // Test 8: Verify Summary Persisted
    results.tests.push({ name: "Verify Summary Persisted in D1", status: "IN_PROGRESS" });
    const persistedSummaries = await getSummariesByStudent(student.id);
    if (persistedSummaries.length === 0) {
      throw new Error("Summary not persisted in D1");
    }
    results.tests[7].status = "PASSED";
    results.tests[7].result = { persistedSummaryCount: persistedSummaries.length };

    // Test 9: Generate Notifications from Summary Event
    results.tests.push({ name: "Generate Notifications from Summary Event", status: "IN_PROGRESS" });
    const summaryEvent = await emitEvent({
      type: "student.summary.generated",
      actorType: "system",
      actorId: "summary-engine",
      studentId: student.id,
      familyId: testFamilyId,
      metadata: { summaryId: summary.id, summaryType: "daily" },
    });

    const notifications = await generateNotificationsFromEvent(summaryEvent);
    if (notifications.length === 0) {
      throw new Error("No notifications generated");
    }
    results.tests[8].status = "PASSED";
    results.tests[8].result = {
      notificationCount: notifications.length,
      channels: [...new Set(notifications.map((n) => n.channel))],
    };

    // Test 10: Verify Notifications Persisted
    results.tests.push({ name: "Verify Notifications Persisted in D1", status: "IN_PROGRESS" });
    const pendingNotifications = await getPendingNotifications(100);
    const summaryNotifications = pendingNotifications.filter(
      (n) => n.eventId === summaryEvent.id
    );
    if (summaryNotifications.length === 0) {
      throw new Error("Notifications not persisted in D1");
    }
    results.tests[9].status = "PASSED";
    results.tests[9].result = {
      persistedNotificationCount: summaryNotifications.length,
      statuses: [...new Set(summaryNotifications.map((n) => n.status))],
    };

    // Test 11: Verify WhatsApp Integration
    results.tests.push({ name: "Verify WhatsApp Integration", status: "IN_PROGRESS" });
    const whatsappContacts = await getWhatsAppContacts(guardian.id);
    if (whatsappContacts.length === 0) {
      throw new Error("WhatsApp contact not found");
    }
    results.tests[10].status = "PASSED";
    results.tests[10].result = {
      contactCount: whatsappContacts.length,
      optedIn: whatsappContacts[0].optedIn,
    };

    // Test 12: Verify Full Flow (eventos → IA → D1 → notificación)
    results.tests.push({ name: "Verify Full Flow (eventos → IA → D1 → notificación)", status: "IN_PROGRESS" });
    results.tests[11].status = "PASSED";
    results.tests[11].result = {
      eventsEmitted: events.length,
      summaryGenerated: true,
      summaryPersisted: persistedSummaries.length > 0,
      notificationsCreated: notifications.length > 0,
      whatsappReady: whatsappContacts.length > 0,
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
