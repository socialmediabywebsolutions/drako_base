import {
  resolveAppointmentsContext,
  listAppointmentsForEmployee,
  listAppointmentsForSaas,
  upsertAppointment,
} from "@/lib/appointments/repository";
import { resolveCustomersContext, listCustomerAppointments } from "@/lib/customers/repository";
import { resolveTasksContext, listTasks } from "@/lib/tasks/repository";
import { resolveKnowledgeContext, listKnowledgeDocumentsForTarget } from "@/lib/knowledge/repository";
import { buildOwnerControlSnapshot } from "@/lib/owner/control-dashboard";
import { getDrakoVendorAccountingSnapshot } from "@/lib/owner/vendor-accounting";
import { buildOwnerAccountingSnapshot, getOwnerMarketingSnapshot } from "@/lib/owner/accounting";
import { getDrakoTreasurySnapshot } from "@/lib/owner/treasury";
import { getSaasTaxSummary } from "@/lib/tax/engine";
import {
  resolveConversationsContext,
  appendMessage,
  createNotification,
  ensureConversationForWhatsapp,
} from "@/lib/conversations/repository";
import type { ConversationMetadata } from "@/lib/conversations/types";
import { classifyWhatsappIntent } from "@/lib/whatsapp/classifier";
import type { WhatsappAutomationResult, WhatsappIntent, WhatsappActorType } from "@/lib/whatsapp/types";
import { resolveWhatsappContext, recordWhatsappMessage, getWhatsappIdentityByPhone } from "@/lib/whatsapp/repository";
import type { DracoEnv } from "@/lib/cf";
import type { AppointmentStatus, SaasAppointment } from "@/lib/appointments/types";
import { queryAll } from "@/lib/db";
import { getDemoOwner } from "@/lib/admin/demo-data";

type OwnerRow = {
  id: string;
};

async function resolveOwnerIdForTenant(tenantId: string): Promise<string | null> {
  const rows = await queryAll<OwnerRow>("SELECT id FROM owners WHERE tenant_id = ? ORDER BY created_at DESC LIMIT 1", tenantId);
  return rows[0]?.id ?? getDemoOwner(tenantId)?.id ?? null;
}

function startOfDay(date: Date): string {
  const start = new Date(date);
  start.setHours(0, 0, 0, 0);
  return start.toISOString();
}

function endOfDay(date: Date): string {
  const end = new Date(date);
  end.setHours(23, 59, 59, 999);
  return end.toISOString();
}

function buildMenu(actorType: WhatsappActorType | null): string[] {
  if (actorType === "EMPLOYEE") {
    return [
      "Comandos disponibles:",
      "- mi horario de hoy",
      "- mi horario de esta semana",
      "- mis tareas de hoy",
    ];
  }
  if (actorType === "SAAS_OWNER") {
    return [
      "Comandos disponibles:",
      "- resumen de hoy",
      "- tareas abiertas",
      "- resumen impuestos",
      "- resumen gastos Campamento Base",
      "- resumen basico",
      "- resumen tesoreria",
      "- cuanto puedo gastar hoy",
      "- resumen marketing",
      "- estado departamentos",
      "- salud saas",
    ];
  }
  return [
    "Comandos disponibles:",
    "- menu",
    "- proxima cita",
    "- tengo cita hoy",
    "- confirmo mi cita",
    "- cancelar mi cita",
  ];
}

function formatAppointmentLine(item: { scheduledStart: string; clientName: string; serviceId: string }) {
  const date = new Date(item.scheduledStart);
  const hh = date.getHours().toString().padStart(2, "0");
  const mm = date.getMinutes().toString().padStart(2, "0");
  return `• ${hh}:${mm} · ${item.clientName} (${item.serviceId})`;
}

function isUpcomingStatus(status: AppointmentStatus): boolean {
  return status !== "CANCELLED" && status !== "NO_SHOW" && status !== "DONE";
}

function buildNextAppointment(appointments: SaasAppointment[]): SaasAppointment | null {
  const sorted = [...appointments].sort((a, b) => new Date(a.scheduledStart).getTime() - new Date(b.scheduledStart).getTime());
  return sorted.find((appt) => isUpcomingStatus(appt.status)) ?? null;
}

async function updateAppointmentWithNote(
  ctx: Awaited<ReturnType<typeof resolveAppointmentsContext>>,
  appointment: SaasAppointment,
  status: AppointmentStatus,
  note: string,
): Promise<SaasAppointment | null> {
  const mergedNotes = [appointment.notes, note].filter(Boolean).join(" | ");
  return upsertAppointment(ctx, {
    id: appointment.id,
    saasId: appointment.saasId,
    serviceId: appointment.serviceId,
    employeeId: appointment.employeeId,
    customerId: appointment.customerId ?? null,
    clientName: appointment.clientName,
    clientContact: appointment.clientContact ?? null,
    scheduledStart: appointment.scheduledStart,
    scheduledEnd: appointment.scheduledEnd,
    status,
    priceAtBooking: appointment.priceAtBooking ?? null,
    socialCampaignId: appointment.socialCampaignId ?? null,
    socialPostId: appointment.socialPostId ?? null,
    sourceChannel: appointment.sourceChannel ?? null,
    notes: mergedNotes || null,
  });
}

export async function runWhatsappAutomation(params: {
  tenantId: string;
  saasId: string;
  phoneNumber: string;
  body: string;
  env?: DracoEnv | null;
  metadata?: Record<string, unknown> | null;
}): Promise<WhatsappAutomationResult> {
  const whatsappCtx = await resolveWhatsappContext({ tenantId: params.tenantId, saasId: params.saasId, env: params.env });
  const identity = await getWhatsappIdentityByPhone(whatsappCtx, params.phoneNumber);
  const actorType = identity?.actorType ?? null;
  const actorId = identity?.actorId ?? null;
  const intent = classifyWhatsappIntent(actorType, params.body);
  const intents: WhatsappIntent[] = [intent];

  const conversationsCtx = await resolveConversationsContext({ tenantId: params.tenantId, saasId: params.saasId, env: params.env });
  const conversation = await ensureConversationForWhatsapp(conversationsCtx, {
    saasId: params.saasId,
    phoneNumber: params.phoneNumber,
    customerId: actorType === "CUSTOMER" ? actorId : null,
    metadata: {
      type: actorType === "EMPLOYEE" ? "INTERNAL" : "CLIENT",
    } as Partial<ConversationMetadata>,
  });

  await recordWhatsappMessage(whatsappCtx, {
    saasId: params.saasId,
    phoneNumber: params.phoneNumber,
    direction: "INBOUND",
    actorType,
    actorId,
    conversationId: conversation.id,
    body: params.body,
    intent,
    status: "PROCESSED",
    providerMessageId: null,
    metadata: params.metadata ?? null,
  });

  await appendMessage(conversationsCtx, {
    conversationId: conversation.id,
    customerId: actorType === "CUSTOMER" ? actorId : null,
    employeeId: actorType === "EMPLOYEE" ? actorId : null,
    senderType: actorType === "EMPLOYEE" ? "STAFF" : actorType === "CUSTOMER" ? "CUSTOMER" : "SYSTEM",
    direction: "INBOUND",
    body: params.body,
  });

  if (actorType === "CUSTOMER") {
    await createNotification(conversationsCtx, {
      saasId: params.saasId,
      employeeId: null,
      type: "CONVERSATION_NEW_MESSAGE",
      severity: "INFO",
      title: "Mensaje nuevo por WhatsApp",
      body: params.body.slice(0, 160),
      relatedEntityType: "CONVERSATION",
      relatedEntityId: conversation.id,
      isRead: false,
    });
  }

  const messagesToSend: { body: string; intent?: WhatsappIntent | null }[] = [];

  if (intent === "SHOW_MENU") {
    messagesToSend.push({ body: buildMenu(actorType).join("\n"), intent });
  }

  if (actorType === "CUSTOMER") {
    const customersCtx = await resolveCustomersContext({ tenantId: params.tenantId, saasId: params.saasId, env: params.env });
    if (intent === "CUSTOMER_TODAY_APPOINTMENTS" || intent === "SHOW_APPOINTMENTS_TODAY") {
      const from = startOfDay(new Date());
      const to = endOfDay(new Date());
      const appointments = actorId ? await listCustomerAppointments(customersCtx, actorId, { from, to }) : [];
      if (!appointments.length) {
        messagesToSend.push({ body: "No tienes citas hoy. Si quieres, escribe 'menu' para ver opciones.", intent });
      } else {
        const lines = appointments.map((appt) => formatAppointmentLine({
          scheduledStart: appt.scheduledStart,
          clientName: appt.clientName,
          serviceId: appt.serviceId,
        }));
        messagesToSend.push({ body: `Tus citas de hoy:\n${lines.join("\n")}`, intent });
      }
    }

    if (intent === "CUSTOMER_NEXT_APPOINTMENT") {
      const from = new Date().toISOString();
      const appointments = actorId ? await listCustomerAppointments(customersCtx, actorId, { from }) : [];
      const next = buildNextAppointment(appointments);
      if (!next) {
        messagesToSend.push({ body: "No encuentro una cita pendiente en tu ficha.", intent });
      } else {
        const dateText = new Date(next.scheduledStart).toLocaleString();
        messagesToSend.push({ body: `Tu próxima cita es el ${dateText} para ${next.serviceId}.`, intent });
      }
    }

    if (intent === "CUSTOMER_CONFIRM_APPOINTMENT" || intent === "CONFIRM_NEXT_APPOINTMENT") {
      const from = new Date().toISOString();
      const appointments = actorId ? await listCustomerAppointments(customersCtx, actorId, { from }) : [];
      const next = buildNextAppointment(appointments);
      if (!next) {
        messagesToSend.push({ body: "No encuentro una cita pendiente. Escribe 'menu' para más opciones.", intent });
      } else {
        const appointmentsCtx = await resolveAppointmentsContext({ tenantId: params.tenantId, saasId: params.saasId, env: params.env });
        const updated = await updateAppointmentWithNote(appointmentsCtx, next, "CONFIRMED", "Confirmada por WhatsApp.");
        messagesToSend.push({ body: `Cita confirmada para ${new Date(next.scheduledStart).toLocaleString()}.`, intent });
        await createNotification(conversationsCtx, {
          saasId: params.saasId,
          employeeId: updated?.employeeId ?? null,
          type: "SYSTEM",
          severity: "INFO",
          title: "Cita confirmada por WhatsApp",
          body: `Cliente confirmó la cita ${new Date(next.scheduledStart).toLocaleString()}.`,
          relatedEntityType: "APPOINTMENT",
          relatedEntityId: next.id,
          isRead: false,
        });
      }
    }

    if (intent === "CUSTOMER_CANCEL_APPOINTMENT") {
      const from = new Date().toISOString();
      const appointments = actorId ? await listCustomerAppointments(customersCtx, actorId, { from }) : [];
      const next = buildNextAppointment(appointments);
      if (!next) {
        messagesToSend.push({ body: "No encuentro una cita pendiente para cancelar.", intent });
      } else {
        const appointmentsCtx = await resolveAppointmentsContext({ tenantId: params.tenantId, saasId: params.saasId, env: params.env });
        const updated = await updateAppointmentWithNote(appointmentsCtx, next, "CANCELLED", "Cancelada por WhatsApp.");
        messagesToSend.push({ body: "Hemos cancelado tu cita. Si quieres reprogramar, escribe 'menu'.", intent });
        await createNotification(conversationsCtx, {
          saasId: params.saasId,
          employeeId: updated?.employeeId ?? null,
          type: "SYSTEM",
          severity: "WARNING",
          title: "Cita cancelada por WhatsApp",
          body: `Cliente canceló la cita ${new Date(next.scheduledStart).toLocaleString()}.`,
          relatedEntityType: "APPOINTMENT",
          relatedEntityId: next.id,
          isRead: false,
        });
      }
    }

    if (intent === "REQUEST_RESCHEDULE") {
      messagesToSend.push({ body: "Hemos registrado tu petición para cambiar la cita. En breve te respondemos.", intent });
    }

    if (intent === "LEAD") {
      messagesToSend.push({
        body: "¡Gracias por tu interés en MentorIA Escolar! Soy el asistente de Marketing. Te enviaré un resumen informativo pronto para que veas cómo podemos ayudar a tus alumnos.",
        intent
      });
    }

    if (intent === "FAQ") {
      messagesToSend.push({
        body: "He consultado nuestra base de conocimiento: MentorIA es una plataforma de tutoría personalizada que usa IA para adaptarse al ritmo de cada estudiante. ¿Deseas saber más sobre algún módulo específico?",
        intent
      });
    }

    if (intent === "EMOTIONAL") {
      messagesToSend.push({
        body: "Siento que estés pasando por un momento difícil. He derivado tu caso al Psicólogo IA, quien te atenderá en breve con total confidencialidad. No estás solo.",
        intent
      });
      await createNotification(conversationsCtx, {
        saasId: params.saasId,
        employeeId: null,
        type: "SYSTEM",
        severity: "WARNING",
        title: "Derivación a Psicólogo IA",
        body: `El usuario ${params.phoneNumber} requiere apoyo emocional.`,
        relatedEntityType: "CONVERSATION",
        relatedEntityId: conversation.id,
        isRead: false,
      });
    }
  }

  if (actorType === "EMPLOYEE") {
    const appointmentsCtx = await resolveAppointmentsContext({ tenantId: params.tenantId, saasId: params.saasId, env: params.env });
    if (intent === "EMPLOYEE_TODAY_SCHEDULE" || intent === "SHOW_TODAY_SCHEDULE") {
      const from = startOfDay(new Date());
      const to = endOfDay(new Date());
      const appointments = actorId ? await listAppointmentsForEmployee(appointmentsCtx, actorId, { from, to }) : [];
      if (!appointments.length) {
        messagesToSend.push({ body: "No tienes citas hoy.", intent });
      } else {
        const lines = appointments.map((appt) => formatAppointmentLine({
          scheduledStart: appt.scheduledStart,
          clientName: appt.clientName,
          serviceId: appt.serviceId,
        }));
        messagesToSend.push({ body: `Agenda de hoy:\n${lines.join("\n")}`, intent });
      }
    }

    if (intent === "EMPLOYEE_WEEK_SCHEDULE") {
      const from = startOfDay(new Date());
      const to = endOfDay(new Date(Date.now() + 6 * 24 * 60 * 60 * 1000));
      const appointments = actorId ? await listAppointmentsForEmployee(appointmentsCtx, actorId, { from, to }) : [];
      if (!appointments.length) {
        messagesToSend.push({ body: "No tienes citas programadas esta semana.", intent });
      } else {
        const grouped = new Map<string, number>();
        appointments.forEach((appt) => {
          const dayKey = new Date(appt.scheduledStart).toLocaleDateString();
          grouped.set(dayKey, (grouped.get(dayKey) ?? 0) + 1);
        });
        const lines = Array.from(grouped.entries()).map(([day, count]) => `• ${day}: ${count} citas`);
        messagesToSend.push({ body: `Resumen semanal:\n${lines.join("\n")}`, intent });
      }
    }

    if (intent === "EMPLOYEE_TODAY_TASKS" || intent === "SHOW_TODAY_TASKS") {
      const tasksCtx = await resolveTasksContext({ tenantId: params.tenantId, saasId: params.saasId, env: params.env });
      const tasks = actorId ? await listTasks(tasksCtx, { assigneeEmployeeId: actorId }) : [];
      const today = new Date().toDateString();
      const openTasks = tasks.filter((task) => task.status === "OPEN" || task.status === "IN_PROGRESS");
      const todays = openTasks.filter((task) => {
        if (!task.dueDate) return true;
        return new Date(task.dueDate).toDateString() === today;
      });
      if (!todays.length) {
        messagesToSend.push({ body: "No tienes tareas abiertas ahora mismo.", intent });
      } else {
        const lines = todays.slice(0, 5).map((task) => `• ${task.title}`);
        messagesToSend.push({ body: `Tareas de hoy:\n${lines.join("\n")}`, intent });
      }
    }

    if (intent === "SHOW_TODAY_PLAYBOOKS") {
      const knowledgeCtx = await resolveKnowledgeContext({ tenantId: params.tenantId, saasId: params.saasId, env: params.env });
      const docs = actorId ? await listKnowledgeDocumentsForTarget(knowledgeCtx, "EMPLOYEE", actorId) : [];
      const filtered = docs.filter((doc) => doc.audience !== "OWNER").slice(0, 4);
      if (!filtered.length) {
        messagesToSend.push({ body: "No hay playbooks asignados para hoy.", intent });
      } else {
        const lines = filtered.map((doc) => `• ${doc.title}`);
        messagesToSend.push({ body: `Playbooks sugeridos:\n${lines.join("\n")}`, intent });
      }
    }
  }

  const isOwnerActor = actorType === "SAAS_OWNER" || actorType === "PLATFORM_OWNER";

  if (isOwnerActor && intent === "OWNER_BASELINE_STATUS") {
    const ownerId = await resolveOwnerIdForTenant(params.tenantId);
    if (!ownerId) {
      messagesToSend.push({ body: "No encuentro owner para este tenant.", intent });
    } else {
      const snapshot = await buildOwnerAccountingSnapshot({ tenantId: params.tenantId, ownerId });
      if (snapshot.totalBaselineMonthly <= 0) {
        messagesToSend.push({ body: "El baseline no esta configurado aun.", intent });
      } else if (snapshot.baselineCovered) {
        messagesToSend.push({
          body: `Has cubierto tus gastos basicos este mes. Necesitabas ${snapshot.totalBaselineMonthly.toFixed(
            0,
          )} € y llevas ${snapshot.totalOwnerRevenueMonthly.toFixed(0)} €. A partir de aqui todo es margen.`,
          intent,
        });
      } else {
        messagesToSend.push({
          body: `Aun no has cubierto tus gastos basicos. Necesitas ${snapshot.totalBaselineMonthly.toFixed(
            0,
          )} € y llevas ${snapshot.totalOwnerRevenueMonthly.toFixed(0)} €. Te faltan ${snapshot.baselineGapAmount.toFixed(0)} €.`,
          intent,
        });
      }
    }
  }

  if (isOwnerActor && intent === "OWNER_TREASURY_STATUS") {
    const ownerId = await resolveOwnerIdForTenant(params.tenantId);
    if (!ownerId) {
      messagesToSend.push({ body: "No encuentro owner para este tenant.", intent });
    } else {
      const snapshot = await getDrakoTreasurySnapshot({ tenantId: params.tenantId, ownerId });
      const lines = [
        "Tesoreria Campamento Base:",
        `• Total cuentas: ${snapshot.totalBalance.toFixed(0)} €`,
        `• Reserva impuestos: ${snapshot.taxReserveBalance.toFixed(0)} € (gap ${snapshot.taxReserveGap.toFixed(0)} €)`,
        `• Reserva IA/Infra: ${(snapshot.aiReserveBalance + snapshot.infraReserveBalance).toFixed(0)} € (gap ${(snapshot.aiReserveGap + snapshot.infraReserveGap).toFixed(0)} €)`,
        `• Gastos personales: ${snapshot.personalSpendingBalance.toFixed(0)} €`,
      ];
      messagesToSend.push({ body: lines.join("\n"), intent });
    }

    await createNotification(conversationsCtx, {
      saasId: params.saasId,
      employeeId: null,
      type: "SYSTEM",
      severity: "INFO",
      title: "Resumen de tesoreria solicitado",
      body: "El owner pidio el resumen de tesoreria.",
      relatedEntityType: "CONVERSATION",
      relatedEntityId: conversation.id,
      isRead: false,
    });
  }

  if (isOwnerActor && intent === "OWNER_SPENDING_ROOM") {
    const ownerId = await resolveOwnerIdForTenant(params.tenantId);
    if (!ownerId) {
      messagesToSend.push({ body: "No encuentro owner para este tenant.", intent });
    } else {
      const snapshot = await buildOwnerAccountingSnapshot({ tenantId: params.tenantId, ownerId });
      const treasury = await getDrakoTreasurySnapshot({ tenantId: params.tenantId, ownerId });
      if (snapshot.baselineCovered) {
        messagesToSend.push({
          body: `Minimo vital cubierto. Necesitabas ${snapshot.totalBaselineMonthly.toFixed(0)} € y llevas ${snapshot.totalOwnerRevenueMonthly.toFixed(
            0,
          )} €. En gastos personales tienes ${treasury.personalSpendingBalance.toFixed(0)} €.`,
          intent,
        });
      } else {
        const conservativeSpend = Math.max(0, treasury.personalSpendingBalance - snapshot.baselineGapAmount);
        messagesToSend.push({
          body: `Aun no has cubierto lo basico. Necesitas ${snapshot.totalBaselineMonthly.toFixed(0)} € y llevas ${snapshot.totalOwnerRevenueMonthly.toFixed(
            0,
          )} €. Te faltan ${snapshot.baselineGapAmount.toFixed(0)} €. Recomendacion: no gastar mas de ${conservativeSpend.toFixed(0)} € ahora.`,
          intent,
        });
      }
    }

    await createNotification(conversationsCtx, {
      saasId: params.saasId,
      employeeId: null,
      type: "SYSTEM",
      severity: "INFO",
      title: "Consulta de gasto personal",
      body: "El owner pidio cuanto puede gastar hoy.",
      relatedEntityType: "CONVERSATION",
      relatedEntityId: conversation.id,
      isRead: false,
    });
  }

  if (isOwnerActor && intent === "OWNER_MARKETING_SUMMARY") {
    const ownerId = await resolveOwnerIdForTenant(params.tenantId);
    if (!ownerId) {
      messagesToSend.push({ body: "No encuentro owner para este tenant.", intent });
    } else {
      const snapshot = await getOwnerMarketingSnapshot({ tenantId: params.tenantId, ownerId });
      const sample = snapshot.items.find((item) => item.status !== "OK") ?? snapshot.items[0];
      const tierOrder = ["BASIC", "STANDARD", "FULL"] as const;
      const packCounts = snapshot.items.reduce(
        (acc, item) => {
          if (item.currentPackTier) {
            acc[item.currentPackTier] += 1;
          }
          return acc;
        },
        { BASIC: 0, STANDARD: 0, FULL: 0 },
      );
      const upgradeCandidate = snapshot.items.find(
        (item) =>
          item.currentPackTier &&
          item.recommendedPackTier &&
          tierOrder.indexOf(item.recommendedPackTier) > tierOrder.indexOf(item.currentPackTier),
      );
      const lines = [
        "Resumen marketing:",
        `• SaaS con marketing configurado: ${snapshot.totalSaasWithMarketingPlan}`,
        `• Cerca del limite: ${snapshot.saasNearLimitCount}`,
        `• Sobre el limite: ${snapshot.saasOverLimitCount}`,
        `• Packs actuales: ${packCounts.BASIC} BASIC, ${packCounts.STANDARD} STANDARD, ${packCounts.FULL} FULL`,
      ];
      if (sample) {
        lines.push(
          `Ejemplo: ${sample.saasName} — ${sample.postsPublishedThisMonth}/${sample.includedPostsPerMonth} posts (${Math.round(
            sample.usagePostsPercent * 100,
          )}%).`,
        );
      }
      if (upgradeCandidate?.recommendedPackDefinition) {
        const currentPrice = upgradeCandidate.currentPackDefinition?.recommendedMonthlyPrice ?? 0;
        const delta = upgradeCandidate.recommendedPackDefinition.recommendedMonthlyPrice - currentPrice;
        const deltaLabel = delta > 0 ? ` (+${delta} €/mes)` : "";
        lines.push(
          `Sugerencia: ${upgradeCandidate.saasName} podría subir a ${upgradeCandidate.recommendedPackTier}${deltaLabel}.`,
        );
      }
      messagesToSend.push({ body: lines.join("\n"), intent });
    }

    await createNotification(conversationsCtx, {
      saasId: params.saasId,
      employeeId: null,
      type: "SYSTEM",
      severity: "INFO",
      title: "Resumen marketing solicitado",
      body: "El owner pidió el resumen de marketing.",
      relatedEntityType: "CONVERSATION",
      relatedEntityId: conversation.id,
      isRead: false,
    });
  }

  if (isOwnerActor && intent === "OWNER_DEPARTMENT_COVERAGE_SUMMARY") {
    const ownerId = await resolveOwnerIdForTenant(params.tenantId);
    if (!ownerId) {
      messagesToSend.push({ body: "No encuentro owner para este tenant.", intent });
    } else {
      const snapshot = await buildOwnerAccountingSnapshot({ tenantId: params.tenantId, ownerId });
      const summary = snapshot.departmentCoverageSummary;
      if (!summary) {
        messagesToSend.push({ body: "No hay datos de coverage disponibles ahora mismo.", intent });
      } else {
        const lines = [
          "Department coverage:",
          `• WELL_COVERED: ${summary.wellCoveredCount}`,
          `• PARTIAL: ${summary.partialCount}`,
          `• CRITICAL_GAP: ${summary.criticalGapCount}`,
        ];
        summary.topGaps.slice(0, 2).forEach((item) => {
          const gaps = item.gaps.map((gap) => gap.departmentId).join(", ");
          lines.push(`${item.saasName}: ${item.status} — ${gaps || "sin gaps"}.`);
        });
        messagesToSend.push({ body: lines.join("\n"), intent });
      }
    }

    await createNotification(conversationsCtx, {
      saasId: params.saasId,
      employeeId: null,
      type: "SYSTEM",
      severity: "INFO",
      title: "Resumen de departamentos solicitado",
      body: "El owner pidió el resumen de coverage por departamentos.",
      relatedEntityType: "CONVERSATION",
      relatedEntityId: conversation.id,
      isRead: false,
    });
  }

  if (isOwnerActor && intent === "OWNER_SAAS_HEALTH_SUMMARY") {
    const ownerId = await resolveOwnerIdForTenant(params.tenantId);
    if (!ownerId) {
      messagesToSend.push({ body: "No encuentro owner para este tenant.", intent });
    } else {
      const snapshot = await buildOwnerAccountingSnapshot({ tenantId: params.tenantId, ownerId });
      const summary = snapshot.saasHealthSummary;
      if (!summary) {
        messagesToSend.push({ body: "No hay datos de salud disponibles ahora mismo.", intent });
      } else {
        const lines = [
          `Tienes ${summary.total} SaaS: ${summary.good} GOOD, ${summary.warning} WARNING, ${summary.critical} CRITICAL.`,
        ];
        const critical = summary.topCritical[0];
        if (critical) {
          const primarySignal = critical.signals.find((signal) => signal.level === "CRITICAL") ?? critical.signals[0];
          lines.push(
            `Ejemplo critico: ${critical.saasName} — ${critical.healthStatus} (score ${critical.healthScore}). ${primarySignal?.message ?? ""}`,
          );
        }
        const healthy = summary.topScaleCandidates[0];
        if (healthy) {
          lines.push(
            `Ejemplo sano: ${healthy.saasName} — ${healthy.healthStatus} (score ${healthy.healthScore}).`,
          );
        }
        messagesToSend.push({ body: lines.join("\n"), intent });
      }
    }

    await createNotification(conversationsCtx, {
      saasId: params.saasId,
      employeeId: null,
      type: "SYSTEM",
      severity: "INFO",
      title: "Resumen de salud SaaS solicitado",
      body: "El owner pidio el resumen de salud y prioridades.",
      relatedEntityType: "CONVERSATION",
      relatedEntityId: conversation.id,
      isRead: false,
    });
  }

  if (isOwnerActor && intent === "OWNER_VENDOR_SUMMARY") {
    const snapshot = await getDrakoVendorAccountingSnapshot({ tenantId: params.tenantId });
    if (snapshot.totalVendorExpensesThisMonth <= 0) {
      messagesToSend.push({ body: "No hay gastos de vendor registrados este mes.", intent });
    } else {
      const aiRow = snapshot.vendorExpensesByType.find((item) => item.type === "AI");
      const aiShare = aiRow ? aiRow.amount / snapshot.totalVendorExpensesThisMonth : 0;
      const worstVertical = snapshot.estimatedMarginByVertical
        .slice()
        .sort((a, b) => a.marginRate - b.marginRate)[0];
      const verticalLabel = worstVertical?.verticalId ?? "UNASSIGNED";
      const recommendation =
        aiShare >= 0.35
          ? "Valora reducir costes de IA o ajustar consumo."
          : worstVertical && worstVertical.marginRate < 0.3
            ? `Considera subir el precio del pack ${verticalLabel}.`
            : worstVertical && worstVertical.marginRate < 0.5
              ? `Revisa modulos activos o pricing en ${verticalLabel}.`
              : `Margen sano en ${verticalLabel}. Puedes activar Social Pack o Ads Management.`;

      const lines = [
        "Resumen Drako Vendor · Campamento Base:",
        `• Gastos este mes: ${snapshot.totalVendorExpensesThisMonth.toFixed(0)} €`,
        `• IA: ${(aiShare * 100).toFixed(0)}% del total`,
      ];
      if (worstVertical) {
        lines.push(
          `• Peor margen: ${verticalLabel} (${(worstVertical.marginRate * 100).toFixed(0)}%)`,
          `  Ingresos ${worstVertical.revenue.toFixed(0)} €, gastos ${worstVertical.vendorCosts.toFixed(0)} €`,
        );
      }
      lines.push(`• Recomendacion: ${recommendation}`);
      messagesToSend.push({ body: lines.join("\n"), intent });
    }

    await createNotification(conversationsCtx, {
      saasId: params.saasId,
      employeeId: null,
      type: "SYSTEM",
      severity: "INFO",
      title: "Resumen vendor solicitado",
      body: "El owner pidió el resumen de gastos de Campamento Base.",
      relatedEntityType: "CONVERSATION",
      relatedEntityId: conversation.id,
      isRead: false,
    });
  }

  if (actorType === "SAAS_OWNER") {
    if (intent === "OWNER_DAILY_SUMMARY" || intent === "SHOW_DAILY_SUMMARY") {
      const snapshot = await buildOwnerControlSnapshot({ tenantId: params.tenantId, saasId: params.saasId });
      const appointmentsCtx = await resolveAppointmentsContext({ tenantId: params.tenantId, saasId: params.saasId, env: params.env });
      const from = startOfDay(new Date());
      const to = endOfDay(new Date());
      const appointments = await listAppointmentsForSaas(appointmentsCtx, { from, to });
      const doneCount = appointments.filter((appt) => appt.status === "DONE").length;
      const pendingCount = appointments.filter((appt) => appt.status !== "DONE" && appt.status !== "CANCELLED").length;
      const revenue = appointments
        .filter((appt) => appt.status === "DONE")
        .reduce((acc, appt) => acc + (appt.priceAtBooking ?? 0), 0);
      const tasksCtx = await resolveTasksContext({ tenantId: params.tenantId, saasId: params.saasId, env: params.env });
      const openTasks = await listTasks(tasksCtx, { status: "OPEN" });
      const criticalActions = (snapshot.autopilotActions ?? []).filter((action) => action.severity === "CRITICAL").length;
      const warningActions = (snapshot.autopilotActions ?? []).filter((action) => action.severity === "WARNING").length;
      messagesToSend.push({
        body: `Resumen de hoy:\n• Citas: ${doneCount} realizadas, ${pendingCount} pendientes\n• Ingreso estimado: ${revenue.toFixed(0)} €\n• Tareas abiertas: ${openTasks.length}\n• Alertas: ${criticalActions} críticas, ${warningActions} warning\nPara impuestos, escribe “resumen impuestos”.`,
        intent,
      });
    }

    if (intent === "SHOW_OPEN_TASKS") {
      const tasksCtx = await resolveTasksContext({ tenantId: params.tenantId, saasId: params.saasId, env: params.env });
      const tasks = await listTasks(tasksCtx, { status: "OPEN" });
      if (!tasks.length) {
        messagesToSend.push({ body: "No hay tareas abiertas ahora mismo.", intent });
      } else {
        const lines = tasks.slice(0, 5).map((task) => `• ${task.title}`);
        messagesToSend.push({ body: `Tareas abiertas:\n${lines.join("\n")}`, intent });
      }
    }

    if (intent === "SHOW_TAX_SUMMARY") {
      const summary = await getSaasTaxSummary({ tenantId: params.tenantId, saasId: params.saasId, env: params.env });
      messagesToSend.push({
        body: `Impuestos trimestre ${summary.currentQuarterKey}:\n• Ingresos: ${summary.currentQuarterRevenue.toFixed(0)} €\n• Gastos: ${summary.currentQuarterExpenses.toFixed(0)} €\n• IVA estimado: ${summary.currentQuarterVatDue.toFixed(0)} €\nEstado: ${summary.status}. Estimación demo.`,
        intent,
      });
    }
  }

  if (intent === "UNKNOWN" && !messagesToSend.length) {
    messagesToSend.push({ body: "No he entendido el mensaje. Escribe 'menu' para ver opciones.", intent: "SHOW_MENU" });
    intents.push("SHOW_MENU");
  }

  for (const outbound of messagesToSend) {
    await recordWhatsappMessage(whatsappCtx, {
      saasId: params.saasId,
      phoneNumber: params.phoneNumber,
      direction: "OUTBOUND",
      actorType,
      actorId,
      conversationId: conversation.id,
      body: outbound.body,
      intent: outbound.intent ?? null,
      status: "SENT",
      providerMessageId: null,
      metadata: null,
    });
    await appendMessage(conversationsCtx, {
      conversationId: conversation.id,
      customerId: actorType === "CUSTOMER" ? actorId : null,
      employeeId: actorType === "EMPLOYEE" ? actorId : null,
      senderType: "STAFF",
      direction: "OUTBOUND",
      body: outbound.body,
    });
  }

  return {
    messagesToSend: messagesToSend.map((item) => ({
      body: item.body,
      intent: item.intent ?? null,
      actorType,
      actorId,
    })),
    linkedConversationId: conversation.id,
    intents,
  };
}
