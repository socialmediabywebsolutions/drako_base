// @ts-nocheck
/// <reference types="vitest" />

import { beforeAll, describe, expect, it, vi } from "vitest";

type ConversationRoute = import("../src/lib/conversation-router/types").ConversationRoute;

type PreparedResult = { success: boolean; changes: number };
type SelectResult<T> = { results: T[] };

type TestD1PreparedStatement = {
  bind: (...params: unknown[]) => TestD1PreparedStatement;
  run: () => Promise<PreparedResult>;
  all: <T>() => Promise<SelectResult<T>>;
  first: <T>() => Promise<T | null>;
  raw: () => Promise<unknown[][]>;
};

type TestD1Database = {
  prepare: (sql: string) => TestD1PreparedStatement;
};

describe("Mentoria WhatsApp integration", () => {
  let routeConversation: typeof import("../src/lib/conversation-router").routeConversation;
  let registerMentoriaWhatsappHandler: typeof import("../src/lib/conversation-router/handlers").registerMentoriaWhatsappHandler;
  let setGlobalEnv: (env: any) => void;

  beforeAll(async () => {
    vi.doUnmock("@/lib/cf");

    const [cfModule, conversationRouter, handlers] = await Promise.all([
      vi.importActual<typeof import("../src/lib/cf")>("../src/lib/cf"),
      import("../src/lib/conversation-router"),
      import("../src/lib/conversation-router/handlers"),
    ]);

    routeConversation = conversationRouter.routeConversation;
    registerMentoriaWhatsappHandler = handlers.registerMentoriaWhatsappHandler;
    setGlobalEnv = cfModule.setGlobalEnv;

    const fakeDb = createMentoriaTestDb();

    setGlobalEnv({
      DRACO_DB: fakeDb,
      MENTORIA_DB: fakeDb,
    } as unknown as Parameters<typeof setGlobalEnv>[0]);

    (globalThis as any).__TEST_DB__ = fakeDb;

    await fakeDb
      .prepare(`INSERT INTO saas_instances (id, tenant_id, platform_type) VALUES (?, ?, ?)`)
      .bind("saas_mentoria", "tenant_mentoria", "mentoria")
      .run();

    await fakeDb
      .prepare(
        `INSERT INTO student_profiles (
           id,
           tenant_id,
           user_id,
           full_name,
           age,
           school_year,
           learning_goals_json,
           base_emotional_state,
           emotional_baseline_json,
           learning_preference,
           preferred_study_minutes,
           strengths_json,
           support_notes,
           onboarding_completed,
           created_at,
           updated_at
         ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`
      )
      .bind(
        "student_mentoria_1",
        "tenant_mentoria",
        null,
        "Alex",
        12,
        "ESO",
        null,
        "balanced",
        null,
        null,
        30,
        null,
        null,
        1,
        new Date().toISOString(),
        new Date().toISOString(),
      )
      .run();

    await fakeDb
      .prepare(
        `INSERT INTO parent_accounts (
           id,
           tenant_id,
           user_id,
           student_profile_id,
           full_name,
           email,
           relation,
           relationship_label,
           daily_study_minutes,
           supervision_level,
           can_view_full_progress,
           can_manage_schedule,
           created_at,
           updated_at
         ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`
      )
      .bind(
        "parent_account_1",
        "tenant_mentoria",
        "guardian_user_1",
        "student_mentoria_1",
        "Madre de Alex",
        "madre@example.com",
        "mother",
        "madre",
        30,
        "balanced",
        1,
        1,
        new Date().toISOString(),
        new Date().toISOString(),
      )
      .run();

    registerMentoriaWhatsappHandler();
  });

  it("routes Mentoria platform type to Mentoria guardian summary flow for closed text intent", async () => {
    const route: ConversationRoute = {
      channel: "whatsapp",
      senderId: "+34611000001",
      tenantId: "tenant_mentoria",
      saasTarget: "mentoria",
      message: "Cómo va",
      metadata: {
        saasId: "saas_mentoria",
        actorType: "CUSTOMER",
        actorId: "guardian_user_1",
      },
    };

    const result = await routeConversation(route);

    expect(result.handler).toBe("mentoria");
    expect(result.handled).toBe(true);
    expect(result.intent).toBe("MENTORIA_GUARDIAN_SUMMARY");
    expect(result.error).toBeUndefined();
    expect(result.reply).toContain("Resumen de Alex:");
  });

  it("rejects guardian messages when intent is not supported", async () => {
    const route: ConversationRoute = {
      channel: "whatsapp",
      senderId: "+34611000001",
      tenantId: "tenant_mentoria",
      saasTarget: "mentoria",
      message: "Necesito hablar",
      metadata: {
        saasId: "saas_mentoria",
        actorType: "CUSTOMER",
        actorId: "guardian_user_1",
      },
    };

    const result = await routeConversation(route);

    expect(result.handler).toBe("mentoria");
    expect(result.handled).toBe(false);
    expect(result.error).toBe("MENTORIA_WHATSAPP_INTENT_NOT_SUPPORTED");
    expect(result.reply).toBeNull();
  });

  it("rejects non-guardian actors for Mentoria WhatsApp phase 1", async () => {
    const route: ConversationRoute = {
      channel: "whatsapp",
      senderId: "+34611000001",
      tenantId: "tenant_mentoria",
      saasTarget: "mentoria",
      message: "resumen",
      metadata: {
        saasId: "saas_mentoria",
        actorType: "EMPLOYEE",
        actorId: "guardian_user_1",
      },
    };

    const result = await routeConversation(route);

    expect(result.handler).toBe("mentoria");
    expect(result.handled).toBe(false);
    expect(result.error).toBe("MENTORIA_WHATSAPP_GUARDIAN_ONLY");
    expect(result.reply).toBeNull();
  });
});

function createMentoriaTestDb(): TestD1Database {
  let saasInstanceRow: { id: string; tenant_id: string; platform_type: string } | null = null;
  let studentProfileRow: {
    id: string;
    tenant_id: string;
    user_id: string | null;
    full_name: string;
    age: number;
    school_year: string;
    learning_goals_json: string | null;
    base_emotional_state: string;
    emotional_baseline_json: string | null;
    learning_preference: string | null;
    preferred_study_minutes: number;
    strengths_json: string | null;
    support_notes: string | null;
    onboarding_completed: number;
    created_at: string;
    updated_at: string;
  } | null = null;
  let parentAccountRow: {
    id: string;
    tenant_id: string;
    user_id: string | null;
    student_profile_id: string;
    full_name: string;
    email: string;
    relation: string;
    relationship_label: string | null;
    daily_study_minutes: number;
    supervision_level: string | null;
    can_view_full_progress: number;
    can_manage_schedule: number;
    created_at: string;
    updated_at: string;
  } | null = null;

  const columnInfo: Record<string, string[]> = {
    saas_instances: ["id", "tenant_id", "platform_type"],
    student_profiles: [
      "id",
      "tenant_id",
      "user_id",
      "full_name",
      "age",
      "school_year",
      "learning_goals_json",
      "base_emotional_state",
      "emotional_baseline_json",
      "learning_preference",
      "preferred_study_minutes",
      "strengths_json",
      "support_notes",
      "onboarding_completed",
      "created_at",
      "updated_at",
    ],
  };

  class FakeStatement implements TestD1PreparedStatement {
    private params: unknown[] = [];

    constructor(private readonly sql: string) {}

    bind(...params: unknown[]): TestD1PreparedStatement {
      this.params = params;
      return this;
    }

    async run(): Promise<PreparedResult> {
      const normalized = this.sql.trim().toUpperCase();
      if (normalized.startsWith("CREATE TABLE")) {
        return { success: true, changes: 0 };
      }

      if (normalized.startsWith("INSERT INTO SAAS_INSTANCES")) {
        const [id, tenantId, platformType] = this.params as [string, string, string];
        saasInstanceRow = { id, tenant_id: tenantId, platform_type: platformType };
        return { success: true, changes: 1 };
      }

      if (normalized.startsWith("INSERT INTO PARENT_ACCOUNTS")) {
        const [
          id,
          tenantId,
          userId,
          studentProfileId,
          fullName,
          email,
          relation,
          relationshipLabel,
          dailyStudyMinutes,
          supervisionLevel,
          canViewFullProgress,
          canManageSchedule,
          createdAt,
          updatedAt,
        ] = this.params as [
          string,
          string,
          string | null,
          string,
          string,
          string,
          string,
          string | null,
          number,
          string | null,
          number,
          number,
          string,
          string,
        ];
        parentAccountRow = {
          id,
          tenant_id: tenantId,
          user_id: userId,
          student_profile_id: studentProfileId,
          full_name: fullName,
          email,
          relation,
          relationship_label: relationshipLabel,
          daily_study_minutes: dailyStudyMinutes,
          supervision_level: supervisionLevel,
          can_view_full_progress: canViewFullProgress,
          can_manage_schedule: canManageSchedule,
          created_at: createdAt,
          updated_at: updatedAt,
        };
        return { success: true, changes: 1 };
      }

      if (normalized.startsWith("INSERT INTO STUDENT_PROFILES")) {
        const [
          id,
          tenantId,
          userId,
          fullName,
          age,
          schoolYear,
          learningGoals,
          baseEmotionalState,
          emotionalBaseline,
          learningPreference,
          preferredMinutes,
          strengths,
          supportNotes,
          onboardingCompleted,
          createdAt,
          updatedAt,
        ] = this.params as [
          string,
          string,
          string | null,
          string,
          number,
          string,
          string | null,
          string,
          string | null,
          string | null,
          number,
          string | null,
          string | null,
          number,
          string,
          string,
        ];
        studentProfileRow = {
          id,
          tenant_id: tenantId,
          user_id: userId,
          full_name: fullName,
          age,
          school_year: schoolYear,
          learning_goals_json: learningGoals,
          base_emotional_state: baseEmotionalState,
          emotional_baseline_json: emotionalBaseline,
          learning_preference: learningPreference,
          preferred_study_minutes: preferredMinutes,
          strengths_json: strengths,
          support_notes: supportNotes,
          onboarding_completed: onboardingCompleted,
          created_at: createdAt,
          updated_at: updatedAt,
        };
        return { success: true, changes: 1 };
      }

      return { success: true, changes: 0 };
    }

    async all<T>(): Promise<SelectResult<T>> {
      const normalized = this.sql.trim().toUpperCase();

      if (normalized.startsWith("PRAGMA TABLE_INFO")) {
        const table = normalized.match(/PRAGMA TABLE_INFO\(([^)]+)\)/)?.[1]?.toLowerCase() ?? "";
        const columns = columnInfo[table] ?? [];
        const results = columns.map((name) => ({ name })) as unknown as T[];
        return { results };
      }

      if (normalized.includes("FROM SAAS_INSTANCES")) {
        const [id, tenantId] = this.params as [string, string];
        const match = saasInstanceRow && saasInstanceRow.id === id && saasInstanceRow.tenant_id === tenantId ? saasInstanceRow : null;
        return { results: match ? ([match] as unknown as T[]) : [] };
      }

      if (normalized.includes("FROM PARENT_ACCOUNTS")) {
        const [tenantId, userId] = this.params as [string, string];
        const match =
          parentAccountRow &&
          parentAccountRow.tenant_id === tenantId &&
          parentAccountRow.user_id === userId
            ? parentAccountRow
            : null;
        return { results: match ? ([match] as unknown as T[]) : [] };
      }

      if (normalized.includes("FROM STUDENT_PROFILES")) {
        const [tenantOrId, maybeStudentId] = this.params as [string, string | undefined];
        const tenantId = maybeStudentId ? tenantOrId : undefined;
        const studentId = maybeStudentId ? maybeStudentId : tenantOrId;
        const match =
          studentProfileRow &&
          (!tenantId || studentProfileRow.tenant_id === tenantId) &&
          studentProfileRow.id === studentId
            ? studentProfileRow
            : null;
        return { results: match ? ([match] as unknown as T[]) : [] };
      }

      return { results: [] };
    }

    async first<T>(): Promise<T | null> {
      const { results } = await this.all<T>();
      return results[0] ?? null;
    }

    async raw(): Promise<unknown[][]> {
      const { results } = await this.all<Record<string, unknown>>();
      return results.map((row) => Object.values(row));
    }
  }

  const fakeDb: TestD1Database = {
    prepare(sql: string) {
      return new FakeStatement(sql);
    },
  };

  return fakeDb;
}
