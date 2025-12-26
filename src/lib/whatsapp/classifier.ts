import type { WhatsappActorType, WhatsappIntent } from "@/lib/whatsapp/types";

function normalizeBody(body: string): string {
  return body
    .trim()
    .toLowerCase()
    .normalize("NFD")
    .replace(/\p{Diacritic}/gu, "")
    .replace(/\s+/g, " ");
}

export function classifyWhatsappIntent(actorType: WhatsappActorType | null, body: string): WhatsappIntent {
  const normalized = normalizeBody(body);
  if (!normalized) return "UNKNOWN";

  if (normalized.includes("menu")) return "SHOW_MENU";

  if (actorType === "CUSTOMER" || actorType === null) {
    if (normalized.includes("proxima cita") || normalized.includes("próxima cita") || normalized.includes("cuando es mi proxima cita")) {
      return "CUSTOMER_NEXT_APPOINTMENT";
    }
    if (normalized.includes("citas hoy") || normalized.includes("tengo cita hoy") || normalized.includes("mis citas")) {
      return "CUSTOMER_TODAY_APPOINTMENTS";
    }
    if (normalized.includes("confirmo") || (normalized.includes("confirmar") && normalized.includes("cita"))) {
      return "CUSTOMER_CONFIRM_APPOINTMENT";
    }
    if (normalized.includes("cancelar") && normalized.includes("cita")) {
      return "CUSTOMER_CANCEL_APPOINTMENT";
    }
    if (normalized.includes("confirmar") && normalized.includes("cita")) return "CONFIRM_NEXT_APPOINTMENT";
    if (normalized.includes("cambiar") && normalized.includes("cita")) return "REQUEST_RESCHEDULE";
    if (normalized.includes("mis citas") || normalized.includes("citas hoy")) return "SHOW_APPOINTMENTS_TODAY";
  }

  if (actorType === "EMPLOYEE") {
    if (normalized.includes("horario de esta semana") || normalized.includes("horario semana") || normalized.includes("agenda semana")) {
      return "EMPLOYEE_WEEK_SCHEDULE";
    }
    if (normalized.includes("horario de hoy") || normalized.includes("agenda hoy") || normalized.includes("que tengo hoy")) {
      return "EMPLOYEE_TODAY_SCHEDULE";
    }
    if (normalized.includes("mis tareas") || normalized.includes("tareas hoy") || normalized.includes("tareas pendientes")) {
      return "EMPLOYEE_TODAY_TASKS";
    }
    if (normalized.includes("agenda hoy") || normalized.includes("agenda")) return "SHOW_TODAY_SCHEDULE";
    if (normalized.includes("mis tareas") || normalized.includes("tareas")) return "SHOW_TODAY_TASKS";
    if (normalized.includes("playbooks") || normalized.includes("protocolos")) return "SHOW_TODAY_PLAYBOOKS";
  }

  if (actorType === "SAAS_OWNER" || actorType === "PLATFORM_OWNER") {
    if (normalized.includes("impuestos") || normalized.includes("iva trimestre") || normalized.includes("iva")) return "SHOW_TAX_SUMMARY";
    if (
      normalized.includes("resumen gastos campamento base") ||
      normalized.includes("gastos campamento base") ||
      normalized.includes("resumen vendor") ||
      normalized.includes("gastos vendor") ||
      normalized.includes("resumen campamento base") ||
      normalized.includes("cuanto estoy gastando como vendor")
    ) {
      return "OWNER_VENDOR_SUMMARY";
    }
    if (
      normalized.includes("resumen basico") ||
      normalized.includes("minimo vital") ||
      normalized.includes("he cubierto lo basico") ||
      normalized.includes("ya he cubierto lo basico") ||
      normalized.includes("mi minimo vital")
    ) {
      return "OWNER_BASELINE_STATUS";
    }
    if (
      normalized.includes("resumen tesoreria") ||
      normalized.includes("estado tesoreria") ||
      normalized.includes("como va tesoreria")
    ) {
      return "OWNER_TREASURY_STATUS";
    }
    if (
      normalized.includes("resumen marketing") ||
      normalized.includes("marketing resumen") ||
      normalized.includes("estado marketing") ||
      normalized.includes("resumen redes")
    ) {
      return "OWNER_MARKETING_SUMMARY";
    }
    if (
      normalized.includes("estado departamentos") ||
      normalized.includes("departamentos ia") ||
      normalized.includes("saas cojos") ||
      normalized.includes("cobertura departamentos") ||
      normalized.includes("estado cobertura")
    ) {
      return "OWNER_DEPARTMENT_COVERAGE_SUMMARY";
    }
    if (
      normalized.includes("salud saas") ||
      normalized.includes("estado salud saas") ||
      normalized.includes("prioridades saas") ||
      normalized.includes("salud de mis saas")
    ) {
      return "OWNER_SAAS_HEALTH_SUMMARY";
    }
    if (
      normalized.includes("cuanto puedo gastar hoy") ||
      normalized.includes("que puedo gastar este mes") ||
      normalized.includes("saldo para gastos personales")
    ) {
      return "OWNER_SPENDING_ROOM";
    }
    if (normalized.includes("resumen de hoy") || normalized.includes("como va el dia") || normalized.includes("estado del negocio hoy")) {
      return "OWNER_DAILY_SUMMARY";
    }
    if (normalized.includes("resumen") || normalized.includes("resumen hoy")) return "SHOW_DAILY_SUMMARY";
    if (normalized.includes("tareas abiertas") || normalized.includes("tareas")) return "SHOW_OPEN_TASKS";
  }

  return "UNKNOWN";
}
