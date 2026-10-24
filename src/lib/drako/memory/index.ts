import { getDb } from "@/lib/db";

export type UserContextValue = string | number | boolean | string[];

export type UserContext = {
  tenantId: string;
  userId: string;
  email?: string;
  role?: string;
  accountId?: string;
  lifecycleStage?: "lead" | "new" | "active" | "at_risk" | "inactive";
  goals?: string[];
  tags?: string[];
  traits?: Record<string, UserContextValue>;
  preferences?: Record<string, UserContextValue>;
};

export type MemoryRecord<TPayload = Record<string, unknown>> = {
  id: string;
  tenantId: string;
  userId: string;
  namespace: string;
  kind: string;
  payload: TPayload;
  createdAt: string;
  updatedAt: string;
};

export type UserMemorySnapshot<TPayload = Record<string, unknown>> = {
  context: UserContext;
  records: MemoryRecord<TPayload>[];
};

export function createUserContext(input: UserContext): UserContext {
  return {
    ...input,
    goals: [...(input.goals ?? [])],
    tags: [...(input.tags ?? [])],
    traits: { ...(input.traits ?? {}) },
    preferences: { ...(input.preferences ?? {}) },
  };
}

type UserMemoryRow = {
  id: string;
  user_id: string;
  context_json: string;
  updated_at: string;
};

function parseUserContext(value: string, userId: string): UserContext {
  let parsed: unknown;
  try {
    parsed = JSON.parse(value);
  } catch (error) {
    throw new Error(`USER_CONTEXT_INVALID_JSON:${userId}:${error instanceof Error ? error.message : String(error)}`);
  }

  if (!parsed || typeof parsed !== "object") {
    throw new Error(`USER_CONTEXT_INVALID_SHAPE:${userId}`);
  }

  const context = parsed as Partial<UserContext>;
  if (typeof context.tenantId !== "string" || typeof context.userId !== "string") {
    throw new Error(`USER_CONTEXT_INVALID_REQUIRED_FIELDS:${userId}`);
  }

  return createUserContext(context as UserContext);
}

export async function getUserContext(userId: string, db: D1Database = getDb()): Promise<UserContext | null> {
  const row = await db
    .prepare(`SELECT id, user_id, context_json, updated_at FROM user_memory WHERE user_id = ? LIMIT 1`)
    .bind(userId)
    .first<UserMemoryRow>();

  if (!row) {
    return null;
  }

  return parseUserContext(row.context_json, row.user_id);
}

export async function saveUserContext(userId: string, context: UserContext, db: D1Database = getDb()): Promise<UserContext> {
  if (context.userId !== userId) {
    throw new Error(`USER_CONTEXT_USER_MISMATCH:${userId}`);
  }

  const now = new Date().toISOString();
  const existing = await db
    .prepare(`SELECT id FROM user_memory WHERE user_id = ? LIMIT 1`)
    .bind(userId)
    .first<{ id: string }>();

  const normalized = createUserContext(context);
  if (existing) {
    await db
      .prepare(`UPDATE user_memory SET context_json = ?, updated_at = ? WHERE user_id = ?`)
      .bind(JSON.stringify(normalized), now, userId)
      .run();
  } else {
    await db
      .prepare(`INSERT INTO user_memory (id, user_id, context_json, updated_at) VALUES (?, ?, ?, ?)`)
      .bind(crypto.randomUUID(), userId, JSON.stringify(normalized), now)
      .run();
  }

  return normalized;
}
