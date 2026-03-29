/**
 * P3 INTELLIGENT ALERTS: Automatic problem detection
 * 
 * Flujo: eventos → análisis → reglas → alertas → notificaciones
 * - Lee eventos reales de D1
 * - Calcula métricas (actividad, errores, progreso)
 * - Aplica reglas de detección
 * - Genera alertas inteligentes
 * - Persiste en D1
 * - Notifica automáticamente
 */

import { getDb } from "@/lib/db";
import { getEventsByStudent } from "@/lib/mentoria/event-system";
import { crypto } from "@cloudflare/workers-types";

export type AlertType = "LOW_ACTIVITY" | "REPEATED_ERRORS" | "NO_PROGRESS" | "DROPOUT_RISK";
export type AlertSeverity = "low" | "medium" | "high";

export interface StudentMetrics {
  totalEvents: number;
  activeMinutes: number;
  activitiesCompleted: number;
  sessionsCount: number;
  progressUpdates: number;
  errorCount: number;
  errorsByType: Record<string, number>;
  dailyActivity: Record<string, number>; // date -> minutes
  progressScore: number;
  lastActivityTime?: string;
}

export interface Alert {
  id: string;
  studentId: string;
  familyId: string;
  type: AlertType;
  severity: AlertSeverity;
  message: string;
  createdAt: string;
}

/**
 * Analiza eventos de un estudiante para detectar problemas
 */
async function analyzeStudentMetrics(
  studentId: string,
  daysBack: number = 7
): Promise<StudentMetrics> {
  const events = await getEventsByStudent(studentId, 500);

  const cutoffTime = new Date(Date.now() - daysBack * 24 * 60 * 60 * 1000).toISOString();
  const recentEvents = events.filter((e) => e.createdAt >= cutoffTime);

  const metrics: StudentMetrics = {
    totalEvents: recentEvents.length,
    activeMinutes: 0,
    activitiesCompleted: 0,
    sessionsCount: 0,
    progressUpdates: 0,
    errorCount: 0,
    errorsByType: {},
    dailyActivity: {},
    progressScore: 0,
  };

  for (const event of recentEvents) {
    // Extraer datos por tipo de evento
    if (event.type === "student.session.completed" && event.metadata?.duration) {
      const minutes = Math.round((event.metadata.duration as number) / 60);
      metrics.activeMinutes += minutes;
      metrics.sessionsCount++;

      // Agrupar por día
      const date = new Date(event.createdAt).toISOString().split("T")[0];
      metrics.dailyActivity[date] = (metrics.dailyActivity[date] || 0) + minutes;
    }

    if (event.type === "student.activity.completed") {
      metrics.activitiesCompleted++;
    }

    if (event.type === "student.progress.updated") {
      metrics.progressUpdates++;
      if (event.metadata?.score) {
        metrics.progressScore = Math.max(metrics.progressScore, event.metadata.score as number);
      }
    }

    // Contar errores (cualquier evento que indique problema)
    if (event.metadata?.error || event.metadata?.failed) {
      metrics.errorCount++;
      const errorType = (event.metadata?.errorType as string) || "unknown";
      metrics.errorsByType[errorType] = (metrics.errorsByType[errorType] || 0) + 1;
    }

    // Último evento
    if (!metrics.lastActivityTime || event.createdAt > metrics.lastActivityTime) {
      metrics.lastActivityTime = event.createdAt;
    }
  }

  return metrics;
}

/**
 * Calcula promedio de actividad diaria
 */
function calculateDailyActivityAverage(dailyActivity: Record<string, number>): number {
  const days = Object.values(dailyActivity);
  if (days.length === 0) return 0;
  return days.reduce((a, b) => a + b, 0) / days.length;
}

/**
 * Detecta alertas basadas en reglas
 */
async function detectAlerts(
  studentId: string,
  familyId: string,
  metrics: StudentMetrics
): Promise<Alert[]> {
  const alerts: Alert[] = [];
  const db = getDb();

  // REGLA 1: LOW_ACTIVITY
  // Actividad ↓ > 40% vs media
  if (metrics.dailyActivity && Object.keys(metrics.dailyActivity).length > 0) {
    const avgDaily = calculateDailyActivityAverage(metrics.dailyActivity);
    const recentDays = Object.entries(metrics.dailyActivity).slice(-2);

    if (recentDays.length > 0) {
      const recentAvg = recentDays.reduce((sum, [_, min]) => sum + min, 0) / recentDays.length;

      if (avgDaily > 0 && recentAvg < avgDaily * 0.6) {
        const alert = await createAlert(
          db,
          studentId,
          familyId,
          "LOW_ACTIVITY",
          "medium",
          `Detectamos que tu hijo ha reducido su actividad esta semana. Podría estar perdiendo el ritmo. Recomendamos dedicar 15 minutos mañana para retomar.`
        );
        alerts.push(alert);
      }
    }
  }

  // REGLA 2: REPEATED_ERRORS
  // Mismo error ≥ 3 veces
  for (const [errorType, count] of Object.entries(metrics.errorsByType)) {
    if (count >= 3) {
      const alert = await createAlert(
        db,
        studentId,
        familyId,
        "REPEATED_ERRORS",
        "medium",
        `Tu hijo ha tenido dificultades repetidas con "${errorType}". Recomendamos practicar este tema específicamente. ¿Necesita ayuda adicional?`
      );
      alerts.push(alert);
    }
  }

  // REGLA 3: NO_PROGRESS
  // Actividad sin progreso real
  if (metrics.activitiesCompleted > 5 && metrics.progressUpdates === 0) {
    const alert = await createAlert(
      db,
      studentId,
      familyId,
      "NO_PROGRESS",
      "high",
      `Tu hijo ha completado varias actividades pero no hay progreso registrado. Podría haber un problema técnico o necesita retroalimentación. Por favor, revisa su trabajo.`
    );
    alerts.push(alert);
  }

  // REGLA 4: DROPOUT_RISK
  // Baja actividad + baja interacción
  const daysSinceLastActivity = metrics.lastActivityTime
    ? Math.floor((Date.now() - new Date(metrics.lastActivityTime).getTime()) / (1000 * 60 * 60 * 24))
    : 999;

  if (metrics.activeMinutes < 30 && daysSinceLastActivity > 2) {
    const alert = await createAlert(
      db,
      studentId,
      familyId,
      "DROPOUT_RISK",
      "high",
      `Alerta importante: Tu hijo no ha estado activo en los últimos ${daysSinceLastActivity} días. Existe riesgo de abandono. Te recomendamos contactar para entender qué está pasando.`
    );
    alerts.push(alert);
  }

  return alerts;
}

/**
 * Crea alerta en D1
 */
async function createAlert(
  db: D1Database,
  studentId: string,
  familyId: string,
  type: AlertType,
  severity: AlertSeverity,
  message: string
): Promise<Alert> {
  const alertId = crypto.randomUUID();
  const createdAt = new Date().toISOString();

  await db
    .prepare(
      `INSERT INTO alerts (id, student_id, family_id, type, severity, message, created_at)
       VALUES (?, ?, ?, ?, ?, ?, ?)`
    )
    .bind(alertId, studentId, familyId, type, severity, message, createdAt)
    .run();

  return {
    id: alertId,
    studentId,
    familyId,
    type,
    severity,
    message,
    createdAt,
  };
}

/**
 * Detecta alertas para un estudiante
 */
export async function detectAlertsForStudent(
  studentId: string,
  familyId: string
): Promise<Alert[]> {
  // Analizar eventos de los últimos 7 días
  const metrics = await analyzeStudentMetrics(studentId, 7);

  // Si no hay eventos, no generar alertas
  if (metrics.totalEvents === 0) {
    return [];
  }

  // Aplicar reglas de detección
  const alerts = await detectAlerts(studentId, familyId, metrics);

  return alerts;
}

/**
 * Obtiene alertas de un estudiante
 */
export async function getAlertsByStudent(
  studentId: string,
  limit: number = 50,
  unresolvedOnly: boolean = false
): Promise<Alert[]> {
  const db = getDb();

  let query = `SELECT id, student_id, family_id, type, severity, message, created_at
               FROM alerts
               WHERE student_id = ?`;

  if (unresolvedOnly) {
    query += ` AND resolved = 0`;
  }

  query += ` ORDER BY created_at DESC LIMIT ?`;

  const result = await db.prepare(query).bind(studentId, limit).all<any>();

  return (result.results ?? []).map((row) => ({
    id: row.id,
    studentId: row.student_id,
    familyId: row.family_id,
    type: row.type as AlertType,
    severity: row.severity as AlertSeverity,
    message: row.message,
    createdAt: row.created_at,
  }));
}

/**
 * Obtiene alertas de una familia
 */
export async function getAlertsByFamily(
  familyId: string,
  limit: number = 100,
  unresolvedOnly: boolean = false
): Promise<Alert[]> {
  const db = getDb();

  let query = `SELECT id, student_id, family_id, type, severity, message, created_at
               FROM alerts
               WHERE family_id = ?`;

  if (unresolvedOnly) {
    query += ` AND resolved = 0`;
  }

  query += ` ORDER BY created_at DESC LIMIT ?`;

  const result = await db.prepare(query).bind(familyId, limit).all<any>();

  return (result.results ?? []).map((row) => ({
    id: row.id,
    studentId: row.student_id,
    familyId: row.family_id,
    type: row.type as AlertType,
    severity: row.severity as AlertSeverity,
    message: row.message,
    createdAt: row.created_at,
  }));
}

/**
 * Marca alerta como resuelta
 */
export async function resolveAlert(alertId: string): Promise<void> {
  const db = getDb();

  await db
    .prepare(`UPDATE alerts SET resolved = 1, resolved_at = ? WHERE id = ?`)
    .bind(new Date().toISOString(), alertId)
    .run();
}

/**
 * Obtiene alertas no resueltas de alta prioridad
 */
export async function getHighPriorityUnresolvedAlerts(limit: number = 100): Promise<Alert[]> {
  const db = getDb();

  const result = await db
    .prepare(
      `SELECT id, student_id, family_id, type, severity, message, created_at
       FROM alerts
       WHERE resolved = 0 AND severity IN ('high', 'medium')
       ORDER BY severity DESC, created_at DESC
       LIMIT ?`
    )
    .bind(limit)
    .all<any>();

  return (result.results ?? []).map((row) => ({
    id: row.id,
    studentId: row.student_id,
    familyId: row.family_id,
    type: row.type as AlertType,
    severity: row.severity as AlertSeverity,
    message: row.message,
    createdAt: row.created_at,
  }));
}
