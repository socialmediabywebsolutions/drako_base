const DEFAULT_INCLUDED_SESSIONS = 10;

export type MentoriaBillingCycle = {
  tenantId: string;
  cycleStart: string;
  cycleEnd: string;
  includedSessions: number;
};

function todayIso(): string {
  return new Date().toISOString().split("T")[0] ?? "1970-01-01";
}

function addDays(start: string, days: number): string {
  const date = new Date(`${start}T00:00:00.000Z`);
  date.setUTCDate(date.getUTCDate() + days);
  return date.toISOString().split("T")[0] ?? start;
}

export async function ensureMentoriaBillingCycleTable(db: D1Database) {
  await db.prepare(
    `CREATE TABLE IF NOT EXISTS mentoria_billing_cycles (
      tenant_id TEXT PRIMARY KEY,
      cycle_start TEXT NOT NULL,
      cycle_end TEXT NOT NULL,
      included_sessions INTEGER NOT NULL DEFAULT 10,
      updated_at TEXT NOT NULL DEFAULT (strftime('%Y-%m-%dT%H:%M:%fZ','now'))
    )`,
  ).run();
}

export async function getMentoriaBillingCycle(db: D1Database, tenantId: string): Promise<MentoriaBillingCycle> {
  await ensureMentoriaBillingCycleTable(db);
  const row = await db.prepare(
    `SELECT tenant_id, cycle_start, cycle_end, included_sessions
     FROM mentoria_billing_cycles
     WHERE tenant_id = ?`,
  ).bind(tenantId).first<{
    tenant_id: string;
    cycle_start: string;
    cycle_end: string;
    included_sessions: number | null;
  }>();

  if (row) {
    return {
      tenantId: row.tenant_id,
      cycleStart: row.cycle_start,
      cycleEnd: row.cycle_end,
      includedSessions: row.included_sessions ?? DEFAULT_INCLUDED_SESSIONS,
    };
  }

  const cycleStart = todayIso();
  const cycleEnd = addDays(cycleStart, 30);
  await db.prepare(
    `INSERT INTO mentoria_billing_cycles (tenant_id, cycle_start, cycle_end, included_sessions)
     VALUES (?, ?, ?, ?)`,
  ).bind(tenantId, cycleStart, cycleEnd, DEFAULT_INCLUDED_SESSIONS).run();

  return {
    tenantId,
    cycleStart,
    cycleEnd,
    includedSessions: DEFAULT_INCLUDED_SESSIONS,
  };
}

export async function updateMentoriaBillingCycle(
  db: D1Database,
  tenantId: string,
  next: { cycleStart: string; cycleEnd: string; includedSessions?: number },
) {
  await ensureMentoriaBillingCycleTable(db);
  await db.prepare(
    `INSERT INTO mentoria_billing_cycles (tenant_id, cycle_start, cycle_end, included_sessions, updated_at)
     VALUES (?, ?, ?, ?, strftime('%Y-%m-%dT%H:%M:%fZ','now'))
     ON CONFLICT(tenant_id) DO UPDATE SET
       cycle_start = excluded.cycle_start,
       cycle_end = excluded.cycle_end,
       included_sessions = excluded.included_sessions,
       updated_at = excluded.updated_at`,
  ).bind(tenantId, next.cycleStart, next.cycleEnd, next.includedSessions ?? DEFAULT_INCLUDED_SESSIONS).run();
}
