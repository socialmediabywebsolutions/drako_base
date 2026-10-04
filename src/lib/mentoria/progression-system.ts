/**
 * Mentoría — Sistema de progresión visual
 * XP, niveles, rachas y logros del alumno.
 */

import type { D1Database } from "@cloudflare/workers-types";

// ─── Tipos ───────────────────────────────────────────────────────────────────

export type StudentProgression = {
  id: string;
  tenantId: string;
  studentId: string;
  xpTotal: number;
  xpThisWeek: number;
  level: number;
  levelName: string;
  levelProgress: number; // 0-100, % hacia el siguiente nivel
  xpToNextLevel: number;
  streakDays: number;
  streakBest: number;
  sessionsCompleted: number;
  sessionsThisWeek: number;
  examsCompleted: number;
  lastActivityDate: string | null;
};

export type StudentAchievement = {
  id: string;
  achievementId: string;
  achievementLabel: string;
  achievementDescription: string;
  achievementIcon: string;
  xpAwarded: number;
  unlockedAt: string;
};

export type XpEventReason =
  | "session_complete"
  | "exam_prep_session"
  | "exam_simulation"
  | "streak_bonus"
  | "achievement"
  | "first_session"
  | "weekly_goal";

// ─── Configuración de niveles ─────────────────────────────────────────────────

const LEVELS: { level: number; name: string; xpRequired: number }[] = [
  { level: 1, name: "Explorador", xpRequired: 0 },
  { level: 2, name: "Estudiante", xpRequired: 100 },
  { level: 3, name: "Constante", xpRequired: 300 },
  { level: 4, name: "Dedicado", xpRequired: 600 },
  { level: 5, name: "Avanzado", xpRequired: 1000 },
  { level: 6, name: "Experto", xpRequired: 1500 },
  { level: 7, name: "Maestro", xpRequired: 2200 },
  { level: 8, name: "Élite", xpRequired: 3000 },
  { level: 9, name: "Campeón", xpRequired: 4000 },
  { level: 10, name: "Leyenda", xpRequired: 5500 },
];

export const XP_REWARDS: Record<XpEventReason, number> = {
  session_complete: 20,
  exam_prep_session: 30,
  exam_simulation: 40,
  streak_bonus: 10,
  achievement: 50,
  first_session: 100,
  weekly_goal: 60,
};

// ─── Logros disponibles ───────────────────────────────────────────────────────

type AchievementDef = {
  id: string;
  label: string;
  description: string;
  icon: string;
  xp: number;
  check: (p: StudentProgression) => boolean;
};

const ACHIEVEMENT_CATALOG: AchievementDef[] = [
  {
    id: "first_session",
    label: "Primera sesión",
    description: "Completaste tu primera sesión de estudio.",
    icon: "🎉",
    xp: 50,
    check: (p) => p.sessionsCompleted >= 1,
  },
  {
    id: "sessions_10",
    label: "10 sesiones",
    description: "10 sesiones completadas. ¡Ya es un hábito!",
    icon: "📚",
    xp: 100,
    check: (p) => p.sessionsCompleted >= 10,
  },
  {
    id: "sessions_50",
    label: "50 sesiones",
    description: "50 sesiones. Nivel de dedicación extraordinario.",
    icon: "🏅",
    xp: 200,
    check: (p) => p.sessionsCompleted >= 50,
  },
  {
    id: "streak_3",
    label: "Racha de 3 días",
    description: "3 días seguidos de estudio.",
    icon: "🔥",
    xp: 30,
    check: (p) => p.streakDays >= 3,
  },
  {
    id: "streak_7",
    label: "Semana perfecta",
    description: "7 días seguidos de estudio.",
    icon: "⚡",
    xp: 80,
    check: (p) => p.streakDays >= 7,
  },
  {
    id: "streak_30",
    label: "Mes imparable",
    description: "30 días seguidos. Eso sí es constancia.",
    icon: "🏆",
    xp: 300,
    check: (p) => p.streakDays >= 30,
  },
  {
    id: "exam_first",
    label: "Primer examen preparado",
    description: "Completaste tu primera preparación de examen.",
    icon: "📝",
    xp: 80,
    check: (p) => p.examsCompleted >= 1,
  },
  {
    id: "exam_5",
    label: "5 exámenes",
    description: "Has preparado 5 exámenes con el tutor.",
    icon: "🎓",
    xp: 150,
    check: (p) => p.examsCompleted >= 5,
  },
  {
    id: "level_5",
    label: "Nivel Avanzado",
    description: "Alcanzaste el nivel 5. ¡Eres un alumno avanzado!",
    icon: "⭐",
    xp: 100,
    check: (p) => p.level >= 5,
  },
];

// ─── Helpers de cálculo ───────────────────────────────────────────────────────

export function calculateLevel(xpTotal: number): {
  level: number;
  name: string;
  progressPercent: number;
  xpToNextLevel: number;
} {
  let current = LEVELS[0];
  for (const lvl of LEVELS) {
    if (xpTotal >= lvl.xpRequired) current = lvl;
    else break;
  }

  const currentIdx = LEVELS.indexOf(current);
  const next = LEVELS[currentIdx + 1];

  if (!next) {
    return { level: current.level, name: current.name, progressPercent: 100, xpToNextLevel: 0 };
  }

  const rangeXp = next.xpRequired - current.xpRequired;
  const earnedInRange = xpTotal - current.xpRequired;
  const progressPercent = Math.min(100, Math.round((earnedInRange / rangeXp) * 100));
  const xpToNextLevel = next.xpRequired - xpTotal;

  return { level: current.level, name: current.name, progressPercent, xpToNextLevel };
}

function todayDate(): string {
  return new Date().toISOString().slice(0, 10);
}

function mondayOfWeek(date: string): string {
  const d = new Date(date + "T12:00:00Z");
  const day = d.getUTCDay();
  const diff = day === 0 ? -6 : 1 - day;
  const monday = new Date(d);
  monday.setUTCDate(d.getUTCDate() + diff);
  return monday.toISOString().slice(0, 10);
}

function daysBetween(a: string, b: string): number {
  const da = new Date(a + "T12:00:00Z");
  const db = new Date(b + "T12:00:00Z");
  return Math.round(Math.abs((db.getTime() - da.getTime()) / 86400000));
}

// ─── Servicio de progresión ───────────────────────────────────────────────────

function rowToProgression(row: Record<string, unknown>): StudentProgression {
  const xpTotal = Number(row.xp_total ?? 0);
  const { level, name: levelName, progressPercent, xpToNextLevel } = calculateLevel(xpTotal);
  return {
    id: String(row.id),
    tenantId: String(row.tenant_id),
    studentId: String(row.student_id),
    xpTotal,
    xpThisWeek: Number(row.xp_this_week ?? 0),
    level,
    levelName,
    levelProgress: progressPercent,
    xpToNextLevel,
    streakDays: Number(row.streak_days ?? 0),
    streakBest: Number(row.streak_best ?? 0),
    sessionsCompleted: Number(row.sessions_completed ?? 0),
    sessionsThisWeek: Number(row.sessions_this_week ?? 0),
    examsCompleted: Number(row.exams_completed ?? 0),
    lastActivityDate: row.last_activity_date ? String(row.last_activity_date) : null,
  };
}

export async function getOrCreateProgression(
  db: D1Database,
  tenantId: string,
  studentId: string,
): Promise<StudentProgression> {
  const existing = await db
    .prepare("SELECT * FROM mentoria_student_progression WHERE student_id = ?")
    .bind(studentId)
    .first<Record<string, unknown>>();

  if (existing) return rowToProgression(existing);

  const id = crypto.randomUUID();
  await db
    .prepare(
      `INSERT INTO mentoria_student_progression
       (id, tenant_id, student_id, xp_total, xp_this_week, level, level_name, streak_days, streak_best,
        sessions_completed, sessions_this_week, exams_completed, last_activity_date, weekly_reset_date)
       VALUES (?, ?, ?, 0, 0, 1, 'Explorador', 0, 0, 0, 0, 0, NULL, ?)`,
    )
    .bind(id, tenantId, studentId, mondayOfWeek(todayDate()))
    .run();

  return getOrCreateProgression(db, tenantId, studentId);
}

export async function awardXp(
  db: D1Database,
  tenantId: string,
  studentId: string,
  reason: XpEventReason,
  sessionId?: string,
): Promise<{ progression: StudentProgression; newAchievements: StudentAchievement[] }> {
  const progression = await getOrCreateProgression(db, tenantId, studentId);
  const xpDelta = XP_REWARDS[reason];
  const today = todayDate();
  const thisWeekMonday = mondayOfWeek(today);

  // Calcular racha
  let newStreak = progression.streakDays;
  if (progression.lastActivityDate) {
    const diff = daysBetween(progression.lastActivityDate, today);
    if (diff === 0) {
      // misma sesión hoy — no modifica racha
    } else if (diff === 1) {
      newStreak += 1;
    } else {
      newStreak = 1; // racha rota
    }
  } else {
    newStreak = 1;
  }

  const newBest = Math.max(progression.streakBest, newStreak);

  // Reset semanal si cambió de semana
  const weeklyReset = progression.lastActivityDate
    ? mondayOfWeek(progression.lastActivityDate) !== thisWeekMonday
    : true;

  const newXpThisWeek = weeklyReset ? xpDelta : progression.xpThisWeek + xpDelta;
  const newSessionsThisWeek = weeklyReset ? 1 : progression.sessionsThisWeek + 1;

  const { level, name: levelName } = calculateLevel(progression.xpTotal + xpDelta);

  await db
    .prepare(
      `UPDATE mentoria_student_progression SET
       xp_total = xp_total + ?,
       xp_this_week = ?,
       level = ?, level_name = ?,
       streak_days = ?, streak_best = ?,
       sessions_completed = sessions_completed + 1,
       sessions_this_week = ?,
       last_activity_date = ?,
       weekly_reset_date = ?,
       updated_at = datetime('now')
       WHERE student_id = ?`,
    )
    .bind(xpDelta, newXpThisWeek, level, levelName, newStreak, newBest, newSessionsThisWeek, today, thisWeekMonday, studentId)
    .run();

  // Registrar evento XP
  await db
    .prepare(
      `INSERT INTO mentoria_xp_events (id, tenant_id, student_id, session_id, reason, xp_delta, created_at)
       VALUES (?, ?, ?, ?, ?, ?, datetime('now'))`,
    )
    .bind(crypto.randomUUID(), tenantId, studentId, sessionId ?? null, reason, xpDelta)
    .run();

  // Bonus de racha (+10 XP si nuevo día)
  if (newStreak > progression.streakDays && progression.lastActivityDate !== today) {
    await awardXp(db, tenantId, studentId, "streak_bonus", sessionId);
  }

  const updatedProgression = await getOrCreateProgression(db, tenantId, studentId);
  const newAchievements = await checkAndUnlockAchievements(db, tenantId, studentId, updatedProgression);

  return { progression: updatedProgression, newAchievements };
}

export async function checkAndUnlockAchievements(
  db: D1Database,
  tenantId: string,
  studentId: string,
  progression: StudentProgression,
): Promise<StudentAchievement[]> {
  const existing = await db
    .prepare("SELECT achievement_id FROM mentoria_student_achievements WHERE student_id = ?")
    .bind(studentId)
    .all<{ achievement_id: string }>();

  const unlockedIds = new Set((existing.results ?? []).map((r) => r.achievement_id));
  const newlyUnlocked: StudentAchievement[] = [];

  for (const def of ACHIEVEMENT_CATALOG) {
    if (unlockedIds.has(def.id)) continue;
    if (!def.check(progression)) continue;

    const id = crypto.randomUUID();
    await db
      .prepare(
        `INSERT INTO mentoria_student_achievements
         (id, tenant_id, student_id, achievement_id, achievement_label, achievement_description, achievement_icon, xp_awarded, unlocked_at)
         VALUES (?, ?, ?, ?, ?, ?, ?, ?, datetime('now'))`,
      )
      .bind(id, tenantId, studentId, def.id, def.label, def.description, def.icon, def.xp)
      .run();

    newlyUnlocked.push({
      id,
      achievementId: def.id,
      achievementLabel: def.label,
      achievementDescription: def.description,
      achievementIcon: def.icon,
      xpAwarded: def.xp,
      unlockedAt: new Date().toISOString(),
    });
  }

  return newlyUnlocked;
}

export async function getAchievements(db: D1Database, studentId: string): Promise<StudentAchievement[]> {
  const rows = await db
    .prepare("SELECT * FROM mentoria_student_achievements WHERE student_id = ? ORDER BY unlocked_at DESC")
    .bind(studentId)
    .all<Record<string, unknown>>();

  return (rows.results ?? []).map((r) => ({
    id: String(r.id),
    achievementId: String(r.achievement_id),
    achievementLabel: String(r.achievement_label),
    achievementDescription: String(r.achievement_description),
    achievementIcon: String(r.achievement_icon),
    xpAwarded: Number(r.xp_awarded ?? 0),
    unlockedAt: String(r.unlocked_at),
  }));
}

export async function recordExamCompleted(
  db: D1Database,
  tenantId: string,
  studentId: string,
): Promise<void> {
  await db
    .prepare(
      `UPDATE mentoria_student_progression SET
       exams_completed = exams_completed + 1, updated_at = datetime('now')
       WHERE student_id = ?`,
    )
    .bind(studentId)
    .run();
}
