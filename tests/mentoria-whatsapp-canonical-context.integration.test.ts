// @ts-nocheck
/// <reference types="vitest" />

import { beforeAll, beforeEach, describe, expect, it, vi } from "vitest";

const recordObservabilityActivity = vi.hoisted(() => vi.fn(async (input: Record<string, unknown>) => ({
  id: "activity_test",
  createdAt: new Date().toISOString(),
  ...input,
})));

vi.mock("@/lib/observability-core", () => ({
  recordObservabilityActivity,
}));

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

describe("Mentoria WhatsApp canonical access and context", () => {
  let routeConversation: typeof import("../src/lib/conversation-router").routeConversation;
  let registerMentoriaWhatsappHandler: typeof import("../src/lib/conversation-router/handlers").registerMentoriaWhatsappHandler;
  let setGlobalEnv: (env: any) => void;

  beforeEach(() => {
    vi.clearAllMocks();
  });

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
    registerMentoriaWhatsappHandler();
  });

  it("uses canonical guardian_student_access before legacy parent_accounts", async () => {
    const fakeDb = createCanonicalTestDb({
      canonicalEnabled: true,
      parentAccounts: [
        {
          id: "pa_legacy",
          tenant_id: "tenant_mentoria",
          user_id: "guardian_user_1",
          student_profile_id: "student_mentoria_1",
          full_name: "Madre de Alex",
          email: "madre@example.com",
          relation: "mother",
          relationship_label: "madre",
          notification_preferences_json: "[]",
          daily_study_minutes: 30,
          supervision_level: "balanced",
          can_view_full_progress: 1,
          can_manage_schedule: 1,
          created_at: new Date().toISOString(),
          updated_at: new Date().toISOString(),
        },
      ],
      guardians: [
        {
          id: "guardian_1",
          email: "madre@example.com",
          name: "Madre de Alex",
          family_id: "tenant_mentoria",
          role: "mother",
          system_role: "primary_guardian",
          family_relation: "mother",
          created_at: new Date().toISOString(),
        },
      ],
      accesses: [
        {
          id: "access_1",
          family_id: "tenant_mentoria",
          guardian_id: "guardian_1",
          student_id: "student_mentoria_2",
          student_profile_id: "student_mentoria_2",
          can_view_full_progress: 1,
          can_manage_schedule: 1,
          daily_study_minutes: 30,
          supervision_level: "balanced",
          notification_preferences_json: JSON.stringify(["progress", "planner"]),
          is_primary_contact: 1,
          created_at: new Date().toISOString(),
          updated_at: new Date().toISOString(),
        },
      ],
    });

    setGlobalEnv({
      DRACO_DB: fakeDb,
      MENTORIA_DB: fakeDb,
    } as any);

    const route: ConversationRoute = {
      channel: "whatsapp",
      senderId: "+34611001001",
      tenantId: "tenant_mentoria",
      saasTarget: "mentoria",
      message: "plan",
      metadata: {
        saasId: "saas_mentoria",
        actorType: "CUSTOMER",
        actorId: "guardian_user_1",
      },
    };

    const result = await routeConversation(route);

    expect(result.handled).toBe(true);
    expect(result.intent).toBe("MENTORIA_GUARDIAN_PLAN");
    expect(result.reply).toContain("Plan actual de Sam:");
    expect(result.reply).not.toContain("Plan actual de Alex:");
  });

  it("requires explicit student context when a guardian has multiple canonical students", async () => {
    const fakeDb = createCanonicalTestDb({
      canonicalEnabled: true,
      parentAccounts: [
        {
          id: "pa_guardian",
          tenant_id: "tenant_mentoria",
          user_id: "guardian_user_1",
          student_profile_id: "student_mentoria_1",
          full_name: "Madre de Alex",
          email: "madre@example.com",
          relation: "mother",
          relationship_label: "madre",
          notification_preferences_json: "[]",
          daily_study_minutes: 30,
          supervision_level: "balanced",
          can_view_full_progress: 1,
          can_manage_schedule: 1,
          created_at: new Date().toISOString(),
          updated_at: new Date().toISOString(),
        },
      ],
      guardians: [
        {
          id: "guardian_1",
          email: "madre@example.com",
          name: "Madre de Alex",
          family_id: "tenant_mentoria",
          role: "mother",
          system_role: "primary_guardian",
          family_relation: "mother",
          created_at: new Date().toISOString(),
        },
      ],
      accesses: [
        {
          id: "access_1",
          family_id: "tenant_mentoria",
          guardian_id: "guardian_1",
          student_id: "student_mentoria_1",
          student_profile_id: "student_mentoria_1",
          can_view_full_progress: 1,
          can_manage_schedule: 1,
          daily_study_minutes: 30,
          supervision_level: "balanced",
          notification_preferences_json: JSON.stringify(["progress"]),
          is_primary_contact: 1,
          created_at: new Date().toISOString(),
          updated_at: new Date().toISOString(),
        },
        {
          id: "access_2",
          family_id: "tenant_mentoria",
          guardian_id: "guardian_1",
          student_id: "student_mentoria_2",
          student_profile_id: "student_mentoria_2",
          can_view_full_progress: 1,
          can_manage_schedule: 1,
          daily_study_minutes: 30,
          supervision_level: "balanced",
          notification_preferences_json: JSON.stringify(["progress"]),
          is_primary_contact: 1,
          created_at: new Date().toISOString(),
          updated_at: new Date().toISOString(),
        },
      ],
    });

    setGlobalEnv({
      DRACO_DB: fakeDb,
      MENTORIA_DB: fakeDb,
    } as any);

    const route: ConversationRoute = {
      channel: "whatsapp",
      senderId: "+34611001002",
      tenantId: "tenant_mentoria",
      saasTarget: "mentoria",
      message: "plan",
      metadata: {
        saasId: "saas_mentoria",
        actorType: "CUSTOMER",
        actorId: "guardian_user_1",
      },
    };

    const result = await routeConversation(route);

    expect(result.handled).toBe(false);
    expect(result.error).toBe("MENTORIA_WHATSAPP_STUDENT_CONTEXT_REQUIRED");
    expect(result.reply).toContain("Alex");
    expect(result.reply).toContain("Sam");
  });

  it("persists conversation_context and reuses the active student on subsequent guardian messages", async () => {
    const fakeDb = createCanonicalTestDb({
      canonicalEnabled: true,
      parentAccounts: [
        {
          id: "pa_guardian",
          tenant_id: "tenant_mentoria",
          user_id: "guardian_user_1",
          student_profile_id: "student_mentoria_1",
          full_name: "Madre de Alex",
          email: "madre@example.com",
          relation: "mother",
          relationship_label: "madre",
          notification_preferences_json: "[]",
          daily_study_minutes: 30,
          supervision_level: "balanced",
          can_view_full_progress: 1,
          can_manage_schedule: 1,
          created_at: new Date().toISOString(),
          updated_at: new Date().toISOString(),
        },
      ],
      guardians: [
        {
          id: "guardian_1",
          email: "madre@example.com",
          name: "Madre de Alex",
          family_id: "tenant_mentoria",
          role: "mother",
          system_role: "primary_guardian",
          family_relation: "mother",
          created_at: new Date().toISOString(),
        },
      ],
      accesses: [
        {
          id: "access_1",
          family_id: "tenant_mentoria",
          guardian_id: "guardian_1",
          student_id: "student_mentoria_1",
          student_profile_id: "student_mentoria_1",
          can_view_full_progress: 1,
          can_manage_schedule: 1,
          daily_study_minutes: 30,
          supervision_level: "balanced",
          notification_preferences_json: JSON.stringify(["progress"]),
          is_primary_contact: 1,
          created_at: new Date().toISOString(),
          updated_at: new Date().toISOString(),
        },
        {
          id: "access_2",
          family_id: "tenant_mentoria",
          guardian_id: "guardian_1",
          student_id: "student_mentoria_2",
          student_profile_id: "student_mentoria_2",
          can_view_full_progress: 1,
          can_manage_schedule: 1,
          daily_study_minutes: 30,
          supervision_level: "balanced",
          notification_preferences_json: JSON.stringify(["progress"]),
          is_primary_contact: 1,
          created_at: new Date().toISOString(),
          updated_at: new Date().toISOString(),
        },
      ],
    });

    setGlobalEnv({
      DRACO_DB: fakeDb,
      MENTORIA_DB: fakeDb,
    } as any);

    const firstRoute: ConversationRoute = {
      channel: "whatsapp",
      senderId: "+34611001003",
      tenantId: "tenant_mentoria",
      saasTarget: "mentoria",
      message: "plan",
      metadata: {
        saasId: "saas_mentoria",
        actorType: "CUSTOMER",
        actorId: "guardian_user_1",
        activeStudentId: "student_mentoria_2",
      },
    };

    const secondRoute: ConversationRoute = {
      ...firstRoute,
      metadata: {
        saasId: "saas_mentoria",
        actorType: "CUSTOMER",
        actorId: "guardian_user_1",
      },
    };

    const first = await routeConversation(firstRoute);
    const second = await routeConversation(secondRoute);

    expect(first.handled).toBe(true);
    expect(first.reply).toContain("Plan actual de Sam:");
    expect(second.handled).toBe(true);
    expect(second.reply).toContain("Plan actual de Sam:");
    expect(fakeDb.__debug().conversationContexts).toHaveLength(1);
    expect(fakeDb.__debug().conversationContexts[0]?.active_student_id).toBe("student_mentoria_2");
  });

  it("falls back to legacy parent_accounts when canonical access is absent", async () => {
    const fakeDb = createCanonicalTestDb({
      canonicalEnabled: false,
      parentAccounts: [
        {
          id: "pa_legacy",
          tenant_id: "tenant_mentoria",
          user_id: "guardian_user_legacy",
          student_profile_id: "student_mentoria_1",
          full_name: "Tutor Legacy",
          email: "legacy@example.com",
          relation: "tutor",
          relationship_label: "tutor",
          notification_preferences_json: "[]",
          daily_study_minutes: 25,
          supervision_level: "balanced",
          can_view_full_progress: 1,
          can_manage_schedule: 0,
          created_at: new Date().toISOString(),
          updated_at: new Date().toISOString(),
        },
      ],
    });

    setGlobalEnv({
      DRACO_DB: fakeDb,
      MENTORIA_DB: fakeDb,
    } as any);

    const route: ConversationRoute = {
      channel: "whatsapp",
      senderId: "+34611001004",
      tenantId: "tenant_mentoria",
      saasTarget: "mentoria",
      message: "plan",
      metadata: {
        saasId: "saas_mentoria",
        actorType: "CUSTOMER",
        actorId: "guardian_user_legacy",
      },
    };

    const result = await routeConversation(route);

    expect(result.handled).toBe(true);
    expect(result.intent).toBe("MENTORIA_GUARDIAN_PLAN");
    expect(result.reply).toContain("Plan actual de Alex:");
  });
});

function createCanonicalTestDb(input?: {
  canonicalEnabled?: boolean;
  parentAccounts?: any[];
  guardians?: any[];
  accesses?: any[];
}) {
  const state = {
    saasInstance: {
      id: "saas_mentoria",
      tenant_id: "tenant_mentoria",
      platform_type: "mentoria",
    },
    studentProfiles: [
      {
        id: "student_mentoria_1",
        tenant_id: "tenant_mentoria",
        user_id: "student_user_1",
        full_name: "Alex",
        age: 12,
        school_year: "ESO",
        learning_goals_json: null,
        base_emotional_state: "balanced",
        emotional_baseline_json: null,
        learning_preference: null,
        preferred_study_minutes: 30,
        strengths_json: null,
        support_notes: null,
        onboarding_completed: 1,
        created_at: new Date().toISOString(),
        updated_at: new Date().toISOString(),
      },
      {
        id: "student_mentoria_2",
        tenant_id: "tenant_mentoria",
        user_id: "student_user_2",
        full_name: "Sam",
        age: 13,
        school_year: "ESO",
        learning_goals_json: null,
        base_emotional_state: "balanced",
        emotional_baseline_json: null,
        learning_preference: null,
        preferred_study_minutes: 30,
        strengths_json: null,
        support_notes: null,
        onboarding_completed: 1,
        created_at: new Date().toISOString(),
        updated_at: new Date().toISOString(),
      },
    ],
    parentAccounts: input?.parentAccounts ?? [],
    guardians: input?.guardians ?? [],
    accesses: input?.accesses ?? [],
    conversationContexts: [] as any[],
    studyPlans: [
      {
        id: "study_plan_1",
        tenant_id: "tenant_mentoria",
        student_profile_id: "student_mentoria_1",
        week_start: "2026-04-07",
        week_end: "2026-04-13",
        goals_summary: "Consolidar algebra",
        generated_by: "planner",
        blocks_json: JSON.stringify([]),
        created_at: new Date().toISOString(),
        updated_at: new Date().toISOString(),
      },
      {
        id: "study_plan_2",
        tenant_id: "tenant_mentoria",
        student_profile_id: "student_mentoria_2",
        week_start: "2026-04-07",
        week_end: "2026-04-13",
        goals_summary: "Preparar ciencias",
        generated_by: "planner",
        blocks_json: JSON.stringify([]),
        created_at: new Date().toISOString(),
        updated_at: new Date().toISOString(),
      },
    ],
    canonicalEnabled: input?.canonicalEnabled ?? true,
  };

  class FakeStatement implements TestD1PreparedStatement {
    private params: unknown[] = [];

    constructor(private readonly sql: string) {}

    bind(...params: unknown[]) {
      this.params = params;
      return this;
    }

    async run(): Promise<PreparedResult> {
      const normalized = this.sql.trim().toUpperCase();

      if (normalized.startsWith("INSERT INTO CONVERSATION_CONTEXT")) {
        const [
          id,
          familyId,
          actorType,
          actorId,
          channel,
          threadKey,
          scopeType,
          activeStudentId,
          status,
          resolvedBy,
          lastExplicitSwitchAt,
          createdAt,
          updatedAt,
        ] = this.params as string[];

        const existingIndex = state.conversationContexts.findIndex(
          (row) =>
            row.family_id === familyId &&
            row.channel === channel &&
            row.thread_key === threadKey &&
            row.actor_type === actorType &&
            row.actor_id === actorId,
        );

        const nextRow = {
          id,
          family_id: familyId,
          actor_type: actorType,
          actor_id: actorId,
          channel,
          thread_key: threadKey,
          scope_type: scopeType,
          active_student_id: activeStudentId,
          status,
          resolved_by: resolvedBy,
          last_explicit_switch_at: lastExplicitSwitchAt,
          created_at: existingIndex >= 0 ? state.conversationContexts[existingIndex].created_at : createdAt,
          updated_at: updatedAt,
        };

        if (existingIndex >= 0) {
          state.conversationContexts[existingIndex] = nextRow;
        } else {
          state.conversationContexts.push(nextRow);
        }

        return { success: true, changes: 1 };
      }

      return { success: true, changes: 0 };
    }

    async all<T>(): Promise<SelectResult<T>> {
      const normalized = this.sql.trim().toUpperCase();

      if (normalized.startsWith("PRAGMA TABLE_INFO(GUARDIANS)")) {
        return {
          results: [
            { name: "id" },
            { name: "email" },
            { name: "name" },
            { name: "family_id" },
            { name: "role" },
            { name: "system_role" },
            { name: "family_relation" },
            { name: "tenant_id" },
            { name: "created_at" },
          ] as unknown as T[],
        };
      }

      if (normalized.includes("FROM SQLITE_MASTER")) {
        const [tableName] = this.params as [string];
        const tables = state.canonicalEnabled
          ? new Set(["guardian_student_access", "conversation_context"])
          : new Set<string>();
        return {
          results: tables.has(String(tableName)) ? ([{ name: tableName }] as unknown as T[]) : [],
        };
      }

      if (normalized.includes("FROM SAAS_INSTANCES")) {
        const [id, tenantId] = this.params as [string, string];
        const match = state.saasInstance.id === id && state.saasInstance.tenant_id === tenantId ? state.saasInstance : null;
        return { results: match ? ([match] as unknown as T[]) : [] };
      }

      if (normalized.includes("FROM GUARDIAN_STUDENT_ACCESS")) {
        const [guardianUserId, tenantId] = this.params as [string, string];
        const bridgeEmails = new Set(
          state.parentAccounts
            .filter((row) => row.tenant_id === tenantId && row.user_id === guardianUserId)
            .map((row) => String(row.email).toLowerCase()),
        );

        const guardianIds = new Set(
          state.guardians
            .filter((guardian) => guardian.family_id === tenantId && bridgeEmails.has(String(guardian.email).toLowerCase()))
            .map((guardian) => guardian.id),
        );

        const results = state.accesses
          .filter((access) => access.family_id === tenantId && guardianIds.has(access.guardian_id))
          .map((access) => {
            const guardian = state.guardians.find((row) => row.id === access.guardian_id) ?? null;
            const student = state.studentProfiles.find((row) => row.id === (access.student_profile_id ?? access.student_id)) ?? null;
            return {
              ...access,
              guardian_email: guardian?.email ?? null,
              guardian_name: guardian?.name ?? null,
              guardian_system_role: guardian?.system_role ?? null,
              guardian_family_relation: guardian?.family_relation ?? guardian?.role ?? null,
              student_name: student?.full_name ?? access.student_id,
            };
          });

        return { results: results as unknown as T[] };
      }

      if (normalized.includes("FROM PARENT_ACCOUNTS PA")) {
        const [tenantId, guardianUserId] = this.params as [string, string];
        const results = state.parentAccounts
          .filter((row) => row.tenant_id === tenantId && row.user_id === guardianUserId)
          .map((row) => {
            const student = state.studentProfiles.find((profile) => profile.id === row.student_profile_id) ?? null;
            return {
              access_id: null,
              family_id: row.tenant_id,
              guardian_id: null,
              student_id: row.student_profile_id,
              student_profile_id: row.student_profile_id,
              can_view_full_progress: row.can_view_full_progress,
              can_manage_schedule: row.can_manage_schedule,
              daily_study_minutes: row.daily_study_minutes,
              supervision_level: row.supervision_level,
              notification_preferences_json: row.notification_preferences_json ?? "[]",
              is_primary_contact: 0,
              guardian_email: row.email,
              guardian_name: row.full_name,
              guardian_system_role: null,
              guardian_family_relation: row.relationship_label ?? row.relation,
              student_name: student?.full_name ?? row.student_profile_id,
              created_at: row.created_at,
              updated_at: row.updated_at,
            };
          });

        return { results: results as unknown as T[] };
      }

      if (normalized.includes("FROM STUDENT_PROFILES")) {
        const [tenantId, studentId] = this.params as [string, string];
        const match = state.studentProfiles.find((row) => row.tenant_id === tenantId && row.id === studentId) ?? null;
        return { results: match ? ([match] as unknown as T[]) : [] };
      }

      if (normalized.includes("FROM MENTORIA_STUDY_PLANS")) {
        const [tenantId, studentId] = this.params as [string, string];
        const match =
          state.studyPlans.find((row) => row.tenant_id === tenantId && row.student_profile_id === studentId) ?? null;
        return { results: match ? ([match] as unknown as T[]) : [] };
      }

      if (normalized.includes("FROM CONVERSATION_CONTEXT")) {
        const [familyId, channel, threadKey, actorType, actorId] = this.params as [string, string, string, string, string];
        const match =
          state.conversationContexts.find(
            (row) =>
              row.family_id === familyId &&
              row.channel === channel &&
              row.thread_key === threadKey &&
              row.actor_type === actorType &&
              row.actor_id === actorId,
          ) ?? null;
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

  const fakeDb: TestD1Database & { __debug: () => Record<string, unknown> } = {
    prepare(sql: string) {
      return new FakeStatement(sql);
    },
    __debug() {
      return {
        conversationContexts: state.conversationContexts,
      };
    },
  };

  return fakeDb;
}
