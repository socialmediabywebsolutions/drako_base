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
        "student_user_1",
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

  it("returns next task for guardian closed command", async () => {
    const route: ConversationRoute = {
      channel: "whatsapp",
      senderId: "+34611000001",
      tenantId: "tenant_mentoria",
      saasTarget: "mentoria",
      message: "proxima tarea",
      metadata: {
        saasId: "saas_mentoria",
        actorType: "CUSTOMER",
        actorId: "guardian_user_1",
      },
    };

    const result = await routeConversation(route);

    expect(result.handler).toBe("mentoria");
    expect(result.handled).toBe(true);
    expect(result.intent).toBe("MENTORIA_GUARDIAN_NEXT_TASK");
    expect(result.reply).toContain("Proxima tarea de Alex:");
    expect(result.reply).toContain("Materia: Matematicas");
  });

  it("returns last session for guardian closed command", async () => {
    const route: ConversationRoute = {
      channel: "whatsapp",
      senderId: "+34611000001",
      tenantId: "tenant_mentoria",
      saasTarget: "mentoria",
      message: "ultima sesion",
      metadata: {
        saasId: "saas_mentoria",
        actorType: "CUSTOMER",
        actorId: "guardian_user_1",
      },
    };

    const result = await routeConversation(route);

    expect(result.handler).toBe("mentoria");
    expect(result.handled).toBe(true);
    expect(result.intent).toBe("MENTORIA_GUARDIAN_LAST_SESSION");
    expect(result.reply).toContain("Ultima sesion de Alex:");
    expect(result.reply).toContain("Tema: Ecuaciones lineales");
  });

  it("returns current plan for guardian closed command", async () => {
    const route: ConversationRoute = {
      channel: "whatsapp",
      senderId: "+34611000001",
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

    expect(result.handler).toBe("mentoria");
    expect(result.handled).toBe(true);
    expect(result.intent).toBe("MENTORIA_GUARDIAN_PLAN");
    expect(result.reply).toContain("Plan actual de Alex:");
    expect(result.reply).toContain("Objetivo: Consolidar algebra y repasar ciencias");
  });

  it("returns active alerts for guardian closed command", async () => {
    const route: ConversationRoute = {
      channel: "whatsapp",
      senderId: "+34611000001",
      tenantId: "tenant_mentoria",
      saasTarget: "mentoria",
      message: "alertas",
      metadata: {
        saasId: "saas_mentoria",
        actorType: "CUSTOMER",
        actorId: "guardian_user_1",
      },
    };

    const result = await routeConversation(route);

    expect(result.handler).toBe("mentoria");
    expect(result.handled).toBe(true);
    expect(result.intent).toBe("MENTORIA_GUARDIAN_ALERTS");
    expect(result.reply).toContain("Alertas de Alex:");
    expect(result.reply).toContain("Nivel: high");
  });

  it("accepts student academic image intake and confirms safe receipt", async () => {
    const route: ConversationRoute = {
      channel: "whatsapp",
      senderId: "+34611000002",
      tenantId: "tenant_mentoria",
      saasTarget: "mentoria",
      message: "foto de tarea",
      metadata: {
        saasId: "saas_mentoria",
        actorType: "CUSTOMER",
        actorId: "student_user_1",
        messageId: "wamid-image-1",
        messageType: "image",
        media: {
          kind: "image",
          mediaId: "media_123",
          mimeType: "image/jpeg",
          caption: "foto de tarea",
        },
      },
    };

    const result = await routeConversation(route);

    expect(result.handler).toBe("mentoria");
    expect(result.handled).toBe(true);
    expect(result.intent).toBe("MENTORIA_STUDENT_MATERIAL_RECEIVED");
    expect(result.error).toBeUndefined();
    expect(result.reply).toContain("He recibido tu imagen, Alex.");
  });

  it("handles duplicate image retries idempotently by source message id", async () => {
    const route: ConversationRoute = {
      channel: "whatsapp",
      senderId: "+34611000002",
      tenantId: "tenant_mentoria",
      saasTarget: "mentoria",
      message: "foto de tarea",
      metadata: {
        saasId: "saas_mentoria",
        actorType: "CUSTOMER",
        actorId: "student_user_1",
        messageId: "wamid-image-retry-1",
        messageType: "image",
        media: {
          kind: "image",
          mediaId: "media_retry_1",
          mimeType: "image/jpeg",
          caption: "foto de tarea",
        },
      },
    };

    const before = (globalThis as any).__TEST_DB__.__debug();
    const first = await routeConversation(route);
    const second = await routeConversation(route);
    const after = (globalThis as any).__TEST_DB__.__debug();

    expect(first.handled).toBe(true);
    expect(first.intent).toBe("MENTORIA_STUDENT_MATERIAL_RECEIVED");
    expect(second.handled).toBe(true);
    expect(second.intent).toBe("MENTORIA_STUDENT_MATERIAL_RECEIVED");
    expect(after.materialIntakeInsertCount - before.materialIntakeInsertCount).toBe(1);
  });

  it("handles duplicate document retries idempotently by source message id", async () => {
    const route: ConversationRoute = {
      channel: "whatsapp",
      senderId: "+34611000004",
      tenantId: "tenant_mentoria",
      saasTarget: "mentoria",
      message: "material de estudio",
      metadata: {
        saasId: "saas_mentoria",
        actorType: "CUSTOMER",
        actorId: "student_user_1",
        messageId: "wamid-document-retry-1",
        messageType: "document",
        media: {
          kind: "document",
          mediaId: "doc_retry_1",
          mimeType: "application/pdf",
          fileName: "material.pdf",
          caption: "material",
        },
      },
    };

    const before = (globalThis as any).__TEST_DB__.__debug();
    const first = await routeConversation(route);
    const second = await routeConversation(route);
    const after = (globalThis as any).__TEST_DB__.__debug();

    expect(first.handled).toBe(true);
    expect(first.intent).toBe("MENTORIA_STUDENT_MATERIAL_RECEIVED");
    expect(second.handled).toBe(true);
    expect(second.intent).toBe("MENTORIA_STUDENT_MATERIAL_RECEIVED");
    expect(after.materialIntakeInsertCount - before.materialIntakeInsertCount).toBe(1);
  });

  it("rejects image intake when actor is not student", async () => {
    const route: ConversationRoute = {
      channel: "whatsapp",
      senderId: "+34611000003",
      tenantId: "tenant_mentoria",
      saasTarget: "mentoria",
      message: "foto de examen",
      metadata: {
        saasId: "saas_mentoria",
        actorType: "EMPLOYEE",
        actorId: "student_user_1",
        messageId: "wamid-image-actor-invalid",
        messageType: "image",
        media: {
          kind: "image",
          mediaId: "media_124",
          mimeType: "image/jpeg",
        },
      },
    };

    const result = await routeConversation(route);

    expect(result.handler).toBe("mentoria");
    expect(result.handled).toBe(false);
    expect(result.error).toBe("MENTORIA_WHATSAPP_STUDENT_ONLY");
    expect(result.reply).toBeNull();
  });

  it("rejects image intake when media metadata is missing", async () => {
    const route: ConversationRoute = {
      channel: "whatsapp",
      senderId: "+34611000004",
      tenantId: "tenant_mentoria",
      saasTarget: "mentoria",
      message: "foto de apuntes",
      metadata: {
        saasId: "saas_mentoria",
        actorType: "CUSTOMER",
        actorId: "student_user_1",
        messageId: "wamid-image-missing-media",
        messageType: "image",
      },
    };

    const result = await routeConversation(route);

    expect(result.handler).toBe("mentoria");
    expect(result.handled).toBe(false);
    expect(result.error).toBe("MENTORIA_WHATSAPP_MEDIA_MISSING");
    expect(result.reply).toBeNull();
  });

  it("rejects image intake when mime type is not image", async () => {
    const route: ConversationRoute = {
      channel: "whatsapp",
      senderId: "+34611000005",
      tenantId: "tenant_mentoria",
      saasTarget: "mentoria",
      message: "foto de ejercicios",
      metadata: {
        saasId: "saas_mentoria",
        actorType: "CUSTOMER",
        actorId: "student_user_1",
        messageId: "wamid-image-invalid-mime",
        messageType: "image",
        media: {
          kind: "image",
          mediaId: "media_125",
          mimeType: "application/pdf",
        },
      },
    };

    const result = await routeConversation(route);

    expect(result.handler).toBe("mentoria");
    expect(result.handled).toBe(false);
    expect(result.error).toBe("MENTORIA_WHATSAPP_MEDIA_TYPE_NOT_SUPPORTED");
    expect(result.reply).toBeNull();
  });

  it("records short student text as context for the latest recent material", async () => {
    const imageRoute: ConversationRoute = {
      channel: "whatsapp",
      senderId: "+34611000006",
      tenantId: "tenant_mentoria",
      saasTarget: "mentoria",
      message: "te mando examen de mates",
      metadata: {
        saasId: "saas_mentoria",
        actorType: "CUSTOMER",
        actorId: "student_user_1",
        messageId: "wamid-image-phase3-base",
        messageType: "image",
        media: {
          kind: "image",
          mediaId: "media_200",
          mimeType: "image/jpeg",
          caption: "te mando examen de mates",
        },
      },
    };

    const contextRoute: ConversationRoute = {
      channel: "whatsapp",
      senderId: "+34611000006",
      tenantId: "tenant_mentoria",
      saasTarget: "mentoria",
      message: "no entendí este ejercicio",
      metadata: {
        saasId: "saas_mentoria",
        actorType: "CUSTOMER",
        actorId: "student_user_1",
        messageId: "wamid-text-phase3-context",
      },
    };

    const imageResult = await routeConversation(imageRoute);
    const contextResult = await routeConversation(contextRoute);

    expect(imageResult.intent).toBe("MENTORIA_STUDENT_MATERIAL_RECEIVED");
    expect(contextResult.handler).toBe("mentoria");
    expect(contextResult.handled).toBe(true);
    expect(contextResult.intent).toBe("MENTORIA_STUDENT_MATERIAL_CONTEXT_RECORDED");
    expect(contextResult.error).toBeUndefined();
    expect(contextResult.reply).toContain("He añadido tu texto al material que enviaste hace un momento, Alex.");
  });

  it("handles duplicate context retries idempotently by source message id", async () => {
    const imageRoute: ConversationRoute = {
      channel: "whatsapp",
      senderId: "+34611000005",
      tenantId: "tenant_mentoria",
      saasTarget: "mentoria",
      message: "foto de apoyo",
      metadata: {
        saasId: "saas_mentoria",
        actorType: "CUSTOMER",
        actorId: "student_user_1",
        messageId: "wamid-image-phase3-retry-base",
        messageType: "image",
        media: {
          kind: "image",
          mediaId: "media_phase3_retry",
          mimeType: "image/jpeg",
          caption: "foto",
        },
      },
    };

    const contextRoute: ConversationRoute = {
      channel: "whatsapp",
      senderId: "+34611000005",
      tenantId: "tenant_mentoria",
      saasTarget: "mentoria",
      message: "Esto era del tema de hoy",
      metadata: {
        saasId: "saas_mentoria",
        actorType: "CUSTOMER",
        actorId: "student_user_1",
        messageId: "wamid-text-phase3-retry-context",
      },
    };

    const before = (globalThis as any).__TEST_DB__.__debug();
    const imageResult = await routeConversation(imageRoute);
    const first = await routeConversation(contextRoute);
    const second = await routeConversation(contextRoute);
    const after = (globalThis as any).__TEST_DB__.__debug();

    expect(imageResult.intent).toBe("MENTORIA_STUDENT_MATERIAL_RECEIVED");
    expect(first.handled).toBe(true);
    expect(first.intent).toBe("MENTORIA_STUDENT_MATERIAL_CONTEXT_RECORDED");
    expect(second.handled).toBe(true);
    expect(second.intent).toBe("MENTORIA_STUDENT_MATERIAL_CONTEXT_RECORDED");
    expect(after.materialContextNoteInsertCount - before.materialContextNoteInsertCount).toBe(1);
  });

  it("rejects student contextual text when no recent material exists", async () => {
    const route: ConversationRoute = {
      channel: "whatsapp",
      senderId: "+34611000007",
      tenantId: "tenant_mentoria",
      saasTarget: "mentoria",
      message: "esta nota es importante",
      metadata: {
        saasId: "saas_mentoria",
        actorType: "CUSTOMER",
        actorId: "student_user_2",
        messageId: "wamid-text-phase3-no-material",
      },
    };

    const result = await routeConversation(route);

    expect(result.handler).toBe("mentoria");
    expect(result.handled).toBe(false);
    expect(result.error).toBe("MENTORIA_WHATSAPP_RECENT_MATERIAL_NOT_FOUND");
    expect(result.reply).toBeNull();
  });

  it("accepts student PDF document intake and confirms safe receipt", async () => {
    const route: ConversationRoute = {
      channel: "whatsapp",
      senderId: "+34611000008",
      tenantId: "tenant_mentoria",
      saasTarget: "mentoria",
      message: "apuntes de ciencias",
      metadata: {
        saasId: "saas_mentoria",
        actorType: "CUSTOMER",
        actorId: "student_user_1",
        messageId: "wamid-document-1",
        messageType: "document",
        media: {
          kind: "document",
          mediaId: "doc_123",
          mimeType: "application/pdf",
          fileName: "apuntes-ciencias.pdf",
          caption: "apuntes de ciencias",
        },
      },
    };

    const result = await routeConversation(route);

    expect(result.handler).toBe("mentoria");
    expect(result.handled).toBe(true);
    expect(result.intent).toBe("MENTORIA_STUDENT_MATERIAL_RECEIVED");
    expect(result.error).toBeUndefined();
    expect(result.reply).toContain("He recibido tu PDF, Alex.");
  });

  it("rejects student document intake when mime type is not pdf", async () => {
    const route: ConversationRoute = {
      channel: "whatsapp",
      senderId: "+34611000009",
      tenantId: "tenant_mentoria",
      saasTarget: "mentoria",
      message: "material de estudio",
      metadata: {
        saasId: "saas_mentoria",
        actorType: "CUSTOMER",
        actorId: "student_user_1",
        messageId: "wamid-document-bad-mime",
        messageType: "document",
        media: {
          kind: "document",
          mediaId: "doc_124",
          mimeType: "application/msword",
          fileName: "material.doc",
        },
      },
    };

    const result = await routeConversation(route);

    expect(result.handler).toBe("mentoria");
    expect(result.handled).toBe(false);
    expect(result.error).toBe("MENTORIA_WHATSAPP_MEDIA_TYPE_NOT_SUPPORTED");
    expect(result.reply).toBeNull();
  });
});

function createMentoriaTestDb(): TestD1Database {
  let materialIntakeInsertCount = 0;
  let materialContextNoteInsertCount = 0;
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
  let dailyPlanRow: {
    id: string;
    tenant_id: string;
    student_profile_id: string;
    plan_date: string;
    recommended_duration: number;
    tasks_json: string;
    completed_task_ids_json: string;
    priority: string;
    adaptation_reason: string;
    generated_at: string;
    created_at: string;
    updated_at: string;
  } | null = {
    id: "daily_plan_1",
    tenant_id: "tenant_mentoria",
    student_profile_id: "student_mentoria_1",
    plan_date: new Date().toISOString().slice(0, 10),
    recommended_duration: 40,
    tasks_json: JSON.stringify([
      { id: "task_1", subject: "Matematicas", type: "practice", difficulty: 3, completed: false },
      { id: "task_2", subject: "Ciencias", type: "review", difficulty: 2, completed: true },
    ]),
    completed_task_ids_json: JSON.stringify(["task_2"]),
    priority: "high",
    adaptation_reason: "refuerzo de algebra",
    generated_at: new Date().toISOString(),
    created_at: new Date().toISOString(),
    updated_at: new Date().toISOString(),
  };
  let studyPlanRow: {
    id: string;
    tenant_id: string;
    student_profile_id: string;
    week_start: string;
    week_end: string;
    goals_summary: string;
    generated_by: string;
    blocks_json: string;
    created_at: string;
    updated_at: string;
  } | null = {
    id: "study_plan_1",
    tenant_id: "tenant_mentoria",
    student_profile_id: "student_mentoria_1",
    week_start: "2026-04-07",
    week_end: "2026-04-13",
    goals_summary: "Consolidar algebra y repasar ciencias",
    generated_by: "planner",
    blocks_json: JSON.stringify([
      { id: "block_1", day: "monday", subjectId: "math", title: "Algebra", goal: "Practicar ecuaciones", durationMinutes: 30, focusMode: true },
    ]),
    created_at: new Date().toISOString(),
    updated_at: new Date().toISOString(),
  };
  let learningSessionRow: {
    id: string;
    tenant_id: string;
    mentor_id: string;
    client_id: string;
    student_profile_id: string;
    subject_id: string;
    topic: string;
    status: string;
    duration_minutes: number;
    ai_tokens_used: number;
    emotional_state: string;
    tutor_summary: string;
    recommended_next_step: string;
    explanation: string | null;
    suggested_steps_json: string | null;
    reinforcement_question: string | null;
    transcript_json: string;
    created_at: string;
    completed_at: string | null;
    updated_at: string;
  } | null = {
    id: "session_1",
    tenant_id: "tenant_mentoria",
    mentor_id: "mentor_1",
    client_id: "client_1",
    student_profile_id: "student_mentoria_1",
    subject_id: "math",
    topic: "Ecuaciones lineales",
    status: "completed",
    duration_minutes: 45,
    ai_tokens_used: 0,
    emotional_state: "confident",
    tutor_summary: "Buena sesion",
    recommended_next_step: "Repasar dos ejercicios mas",
    explanation: null,
    suggested_steps_json: null,
    reinforcement_question: null,
    transcript_json: JSON.stringify([]),
    created_at: new Date().toISOString(),
    completed_at: new Date().toISOString(),
    updated_at: new Date().toISOString(),
  };
  let interventionRow: {
    id: string;
    tenant_id: string;
    student_profile_id: string;
    intervention_type: string;
    severity: string;
    status: string;
    summary: string;
    recommendations_json: string;
    channels_json: string;
    metadata_json: string;
    created_at: string;
    updated_at: string;
    resolved_at: string | null;
  } | null = {
    id: "intervention_1",
    tenant_id: "tenant_mentoria",
    student_profile_id: "student_mentoria_1",
    intervention_type: "low_consistency",
    severity: "high",
    status: "active",
    summary: "Ha bajado la constancia esta semana",
    recommendations_json: JSON.stringify(["Revisar el plan diario con Alex hoy"]),
    channels_json: JSON.stringify(["parent"]),
    metadata_json: JSON.stringify({}),
    created_at: new Date().toISOString(),
    updated_at: new Date().toISOString(),
    resolved_at: null,
  };
  let secondStudentProfileRow: {
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
  } | null = {
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
  };
  let materialIntakeRow: {
    id: string;
    tenant_id: string;
    student_profile_id: string;
    channel: string;
    source_message_id: string;
    phone_number: string;
    media_type: string;
    intake_kind: string;
    provider_media_id: string;
    mime_type: string;
    file_name: string | null;
    caption: string | null;
    original_text: string | null;
    status: string;
    created_at: string;
    updated_at: string;
  } | null = null;
  let materialContextNoteRow: {
    id: string;
    tenant_id: string;
    student_profile_id: string;
    material_intake_id: string;
    channel: string;
    source_message_id: string;
    body: string;
    created_at: string;
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

      if (normalized.startsWith("INSERT INTO MENTORIA_MATERIAL_CONTEXT_NOTES")) {
        const [id, tenantId, studentProfileId, materialIntakeId, sourceMessageId, body, createdAt] = this.params as [
          string,
          string,
          string,
          string,
          string,
          string,
          string,
        ];
        if (materialContextNoteRow && materialContextNoteRow.tenant_id === tenantId && materialContextNoteRow.source_message_id === sourceMessageId) {
          throw new Error("UNIQUE constraint failed: mentoria_material_context_notes.tenant_id, mentoria_material_context_notes.source_message_id");
        }
        materialContextNoteRow = {
          id,
          tenant_id: tenantId,
          student_profile_id: studentProfileId,
          material_intake_id: materialIntakeId,
          channel: "whatsapp",
          source_message_id: sourceMessageId,
          body,
          created_at: createdAt,
        };
        materialContextNoteInsertCount += 1;
        return { success: true, changes: 1 };
      }

      if (normalized.startsWith("INSERT INTO MENTORIA_MATERIAL_INTAKES")) {
        const [
          id,
          tenantId,
          studentProfileId,
          sourceMessageId,
          phoneNumber,
          mediaType,
          intakeKind,
          providerMediaId,
          mimeType,
          fileName,
          caption,
          originalText,
          createdAt,
          updatedAt,
        ] = this.params as [
          string,
          string,
          string,
          string,
          string,
          string,
          string,
          string,
          string,
          string | null,
          string | null,
          string | null,
          string,
          string,
        ];
        if (materialIntakeRow && materialIntakeRow.tenant_id === tenantId && materialIntakeRow.source_message_id === sourceMessageId) {
          throw new Error("UNIQUE constraint failed: mentoria_material_intakes.tenant_id, mentoria_material_intakes.source_message_id");
        }
        materialIntakeRow = {
          id,
          tenant_id: tenantId,
          student_profile_id: studentProfileId,
          channel: "whatsapp",
          source_message_id: sourceMessageId,
          phone_number: phoneNumber,
          media_type: mediaType,
          intake_kind: intakeKind,
          provider_media_id: providerMediaId,
          mime_type: mimeType,
          file_name: fileName,
          caption,
          original_text: originalText,
          status: "received",
          created_at: createdAt,
          updated_at: updatedAt,
        };
        materialIntakeInsertCount += 1;
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

      if (normalized.includes("FROM MENTORIA_DAILY_PLANS")) {
        const [tenantId, studentId, planDate] = this.params as [string, string, string];
        const match =
          dailyPlanRow &&
          dailyPlanRow.tenant_id === tenantId &&
          dailyPlanRow.student_profile_id === studentId &&
          dailyPlanRow.plan_date === planDate
            ? dailyPlanRow
            : null;
        return { results: match ? ([match] as unknown as T[]) : [] };
      }

      if (normalized.includes("FROM MENTORIA_STUDY_PLANS")) {
        const [tenantId, studentProfileId] = this.params as [string, string];
        const match =
          studyPlanRow &&
          studyPlanRow.tenant_id === tenantId &&
          studyPlanRow.student_profile_id === studentProfileId
            ? studyPlanRow
            : null;
        return { results: match ? ([match] as unknown as T[]) : [] };
      }

      if (normalized.includes("FROM MENTORIA_SESSIONS")) {
        const [tenantId, studentProfileId] = this.params as [string, string];
        const match =
          learningSessionRow &&
          learningSessionRow.tenant_id === tenantId &&
          learningSessionRow.student_profile_id === studentProfileId
            ? learningSessionRow
            : null;
        return { results: match ? ([match] as unknown as T[]) : [] };
      }

      if (normalized.includes("FROM MENTORIA_INTERVENTIONS")) {
        const [tenantId, studentProfileId] = this.params as [string, string];
        const match =
          interventionRow &&
          interventionRow.tenant_id === tenantId &&
          interventionRow.student_profile_id === studentProfileId
            ? interventionRow
            : null;
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

      if (normalized.includes("FROM MENTORIA_MATERIAL_INTAKES")) {
        if (normalized.includes("STUDENT_PROFILE_ID = ?") && normalized.includes("ORDER BY CREATED_AT DESC")) {
          const [tenantId, studentProfileId] = this.params as [string, string];
          const match =
            materialIntakeRow &&
            materialIntakeRow.tenant_id === tenantId &&
            materialIntakeRow.student_profile_id === studentProfileId
              ? materialIntakeRow
              : null;
          return { results: match ? ([match] as unknown as T[]) : [] };
        }

        if (normalized.includes("SOURCE_MESSAGE_ID = ?")) {
          const [tenantId, sourceMessageId] = this.params as [string, string];
          const match =
            materialIntakeRow &&
            materialIntakeRow.tenant_id === tenantId &&
            materialIntakeRow.source_message_id === sourceMessageId
              ? materialIntakeRow
              : null;
          return { results: match ? ([match] as unknown as T[]) : [] };
        }

        const [tenantId, id] = this.params as [string, string];
        const match =
          materialIntakeRow &&
          materialIntakeRow.tenant_id === tenantId &&
          materialIntakeRow.id === id
            ? materialIntakeRow
            : null;
        return { results: match ? ([match] as unknown as T[]) : [] };
      }

      if (normalized.includes("FROM STUDENT_PROFILES")) {
        const [tenantOrId, maybeValue] = this.params as [string, string | undefined];
        const studentRows = [studentProfileRow, secondStudentProfileRow].filter(Boolean);
        const match =
          normalized.includes("USER_ID = ?")
            ? studentRows.find((row) => row.tenant_id === tenantOrId && row.user_id === maybeValue) ?? null
            : studentRows.find((row) => (!maybeValue || row.tenant_id === tenantOrId) && row.id === (maybeValue ?? tenantOrId)) ?? null;
        return { results: match ? ([match] as unknown as T[]) : [] };
      }

      if (normalized.includes("FROM MENTORIA_MATERIAL_CONTEXT_NOTES")) {
        if (normalized.includes("SOURCE_MESSAGE_ID = ?")) {
          const [tenantId, sourceMessageId] = this.params as [string, string];
          const match =
            materialContextNoteRow &&
            materialContextNoteRow.tenant_id === tenantId &&
            materialContextNoteRow.source_message_id === sourceMessageId
              ? materialContextNoteRow
              : null;
          return { results: match ? ([match] as unknown as T[]) : [] };
        }

        const [tenantId, id] = this.params as [string, string];
        const match =
          materialContextNoteRow &&
          materialContextNoteRow.tenant_id === tenantId &&
          materialContextNoteRow.id === id
            ? materialContextNoteRow
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

  (fakeDb as any).__debug = () => ({
    materialIntakeInsertCount,
    materialContextNoteInsertCount,
  });

  return fakeDb;
}
