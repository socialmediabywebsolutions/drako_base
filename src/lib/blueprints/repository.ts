import { env as resolveEnv, type DracoEnv } from "@/lib/cf";
import { queryAll, run } from "@/lib/db";
import {
  getDemoSaasBlueprint,
  listDemoSaasModules,
  listDemoSaasInterviewAnswers,
  recordDemoSaasInterviewAnswers,
  saveDemoSaasBlueprint,
  saveDemoSaasModules,
} from "@/lib/admin/demo-data";
import { DEMO_TENANT_ID } from "@/lib/tenants/services";
import type {
  SaasBlueprint,
  SaasModule,
  SaasInterviewAnswer,
  BusinessType,
  BlueprintPrimaryGoal,
  BlueprintMaturityStage,
  SaasModuleCode,
  SaasModuleStatus,
} from "@/lib/blueprints/types";

export type BlueprintsContextMode = "d1" | "demo";

export class BlueprintsContextError extends Error {
  constructor(message: string) {
    super(message);
    this.name = "BlueprintsContextError";
  }
}

export type BlueprintsContext = {
  tenantId: string;
  saasId: string | null;
  mode: BlueprintsContextMode;
  allowDemoFallback: boolean;
  demoTenantId?: string;
  db?: D1Database;
  env?: DracoEnv | null;
};

const FALLBACK_ERROR_PATTERNS = ["no such table", "no such column"];

function resolveEnvOverride(envOverride?: DracoEnv | null): DracoEnv | null {
  if (envOverride) return envOverride;
  return resolveEnv();
}

function hasDatabase(envOverride?: DracoEnv | null): boolean {
  return Boolean(resolveEnvOverride(envOverride)?.DRACO_DB);
}

function isDemoFeatureEnabled(tenantId: string, envOverride?: DracoEnv | null): boolean {
  if (tenantId === DEMO_TENANT_ID) return true;
  const runtimeEnv = resolveEnvOverride(envOverride);
  const flag = runtimeEnv?.DRAKO_DEMO_MODE ?? process.env.DRAKO_DEMO_MODE;
  return typeof flag === "string" && flag.toLowerCase() === "true";
}

function shouldFallbackToDemo(error: unknown, ctx: BlueprintsContext): boolean {
  if (ctx.mode !== "d1" || !ctx.allowDemoFallback) return false;
  const message = (error instanceof Error ? error.message : `${error ?? ""}`).toLowerCase();
  return FALLBACK_ERROR_PATTERNS.some((pattern) => message.includes(pattern));
}

function requireSaasId(ctx: BlueprintsContext): string {
  const saasId = ctx.saasId?.trim();
  if (!saasId) {
    throw new BlueprintsContextError("saasId is required for blueprints.");
  }
  return saasId;
}

function demoTenantId(ctx: BlueprintsContext): string {
  return ctx.demoTenantId ?? ctx.tenantId;
}

export async function resolveBlueprintsContext({
  tenantId,
  saasId,
  env,
}: {
  tenantId: string;
  saasId?: string | null;
  env?: DracoEnv | null;
}): Promise<BlueprintsContext> {
  const normalizedSaasId = saasId?.trim() ?? null;
  const demoEnabled = isDemoFeatureEnabled(tenantId, env);

  if (hasDatabase(env)) {
    const runtimeEnv = resolveEnvOverride(env);
    return {
      tenantId,
      saasId: normalizedSaasId,
      mode: "d1",
      allowDemoFallback: demoEnabled,
      demoTenantId: demoEnabled ? DEMO_TENANT_ID : undefined,
      db: runtimeEnv?.DRACO_DB,
      env: runtimeEnv,
    };
  }

  if (!demoEnabled) {
    throw new BlueprintsContextError("Blueprints module is not enabled for this tenant.");
  }

  return {
    tenantId,
    saasId: normalizedSaasId,
    mode: "demo",
    allowDemoFallback: true,
    demoTenantId: DEMO_TENANT_ID,
    env,
  };
}

type BlueprintRow = {
  id: string;
  tenant_id: string;
  saas_id: string;
  business_type: string;
  primary_goal: string;
  maturity_stage: string;
  notes: string | null;
  created_at: string;
  updated_at: string;
};

type ModuleRow = {
  id: string;
  tenant_id: string;
  saas_id: string;
  code: string;
  label: string;
  phase: number;
  status: string;
  importance: number;
  description: string | null;
  created_at: string;
  updated_at: string;
};

type InterviewRow = {
  id: string;
  tenant_id: string;
  saas_id: string;
  question_code: string;
  answer_text: string;
  metadata: string | null;
  created_at: string;
};

function mapBlueprintRow(row: BlueprintRow): SaasBlueprint {
  return {
    id: row.id,
    tenantId: row.tenant_id,
    saasId: row.saas_id,
    businessType: row.business_type as BusinessType,
    primaryGoal: row.primary_goal as BlueprintPrimaryGoal,
    maturityStage: row.maturity_stage as BlueprintMaturityStage,
    notes: row.notes ?? undefined,
    createdAt: row.created_at,
    updatedAt: row.updated_at,
  };
}

function mapModuleRow(row: ModuleRow): SaasModule {
  return {
    id: row.id,
    tenantId: row.tenant_id,
    saasId: row.saas_id,
    code: row.code as SaasModuleCode,
    label: row.label,
    phase: row.phase,
    status: row.status as SaasModuleStatus,
    importance: row.importance,
    description: row.description ?? undefined,
    createdAt: row.created_at,
    updatedAt: row.updated_at,
  };
}

function mapInterviewRow(row: InterviewRow): SaasInterviewAnswer {
  return {
    id: row.id,
    tenantId: row.tenant_id,
    saasId: row.saas_id,
    questionCode: row.question_code,
    answerText: row.answer_text,
    metadata: row.metadata ? JSON.parse(row.metadata) : undefined,
    createdAt: row.created_at,
  };
}

export async function getSaasBlueprint(ctx: BlueprintsContext, saasId: string): Promise<SaasBlueprint | null> {
  if (ctx.mode === "demo") {
    const record = getDemoSaasBlueprint(demoTenantId(ctx), saasId);
    return record ? mapBlueprintRow(record) : null;
  }
  try {
    const rows = await queryAll<BlueprintRow>(
      `SELECT id, tenant_id, saas_id, business_type, primary_goal, maturity_stage, notes, created_at, updated_at
       FROM saas_blueprints
       WHERE tenant_id = ? AND saas_id = ?
       LIMIT 1`,
      ctx.tenantId,
      saasId,
    );
    return rows[0] ? mapBlueprintRow(rows[0]) : null;
  } catch (error) {
    if (shouldFallbackToDemo(error, ctx)) {
      const record = getDemoSaasBlueprint(demoTenantId(ctx), saasId);
      return record ? mapBlueprintRow(record) : null;
    }
    throw error;
  }
}

export async function upsertSaasBlueprint(
  ctx: BlueprintsContext,
  input: {
    id?: string;
    saasId: string;
    businessType: BusinessType;
    primaryGoal: BlueprintPrimaryGoal;
    maturityStage: BlueprintMaturityStage;
    notes?: string | null;
  },
): Promise<SaasBlueprint> {
  const saasId = input.saasId?.trim() ?? requireSaasId(ctx);
  const now = new Date().toISOString();
  const id = input.id?.trim() ?? `${Date.now()}_${Math.random().toString(16).slice(2)}`;

  if (ctx.mode === "demo") {
    const record = saveDemoSaasBlueprint(demoTenantId(ctx), {
      id,
      saas_id: saasId,
      business_type: input.businessType,
      primary_goal: input.primaryGoal,
      maturity_stage: input.maturityStage,
      notes: input.notes ?? null,
    });
    return mapBlueprintRow(record);
  }
  try {
    await run(
      `INSERT INTO saas_blueprints (id, tenant_id, saas_id, business_type, primary_goal, maturity_stage, notes, created_at, updated_at)
       VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?)
       ON CONFLICT(tenant_id, saas_id) DO UPDATE SET
         business_type = excluded.business_type,
         primary_goal = excluded.primary_goal,
         maturity_stage = excluded.maturity_stage,
         notes = excluded.notes,
         updated_at = excluded.updated_at`,
      id,
      ctx.tenantId,
      saasId,
      input.businessType,
      input.primaryGoal,
      input.maturityStage,
      input.notes ?? null,
      now,
      now,
    );
    const rows = await queryAll<BlueprintRow>(
      `SELECT id, tenant_id, saas_id, business_type, primary_goal, maturity_stage, notes, created_at, updated_at
       FROM saas_blueprints
       WHERE tenant_id = ? AND saas_id = ?
       LIMIT 1`,
      ctx.tenantId,
      saasId,
    );
    return mapBlueprintRow(rows[0]);
  } catch (error) {
    if (shouldFallbackToDemo(error, ctx)) {
      const record = saveDemoSaasBlueprint(demoTenantId(ctx), {
        id,
        saas_id: saasId,
        business_type: input.businessType,
        primary_goal: input.primaryGoal,
        maturity_stage: input.maturityStage,
        notes: input.notes ?? null,
      });
      return mapBlueprintRow(record);
    }
    throw error;
  }
}

export async function listSaasModules(ctx: BlueprintsContext, saasId: string): Promise<SaasModule[]> {
  if (ctx.mode === "demo") {
    return listDemoSaasModules(demoTenantId(ctx), saasId).map(mapModuleRow);
  }
  try {
    const rows = await queryAll<ModuleRow>(
      `SELECT id, tenant_id, saas_id, code, label, phase, status, importance, description, created_at, updated_at
       FROM saas_modules
       WHERE tenant_id = ? AND saas_id = ?
       ORDER BY phase ASC, importance DESC`,
      ctx.tenantId,
      saasId,
    );
    return rows.map(mapModuleRow);
  } catch (error) {
    if (shouldFallbackToDemo(error, ctx)) {
      return listDemoSaasModules(demoTenantId(ctx), saasId).map(mapModuleRow);
    }
    throw error;
  }
}

export async function upsertSaasModule(
  ctx: BlueprintsContext,
  input: {
    id?: string;
    saasId: string;
    code: SaasModuleCode;
    label: string;
    phase: number;
    status: SaasModuleStatus;
    importance: number;
    description?: string | null;
  },
): Promise<SaasModule> {
  const saasId = input.saasId?.trim() ?? requireSaasId(ctx);
  const now = new Date().toISOString();
  const id = input.id?.trim() ?? `${Date.now()}_${Math.random().toString(16).slice(2)}`;

  if (ctx.mode === "demo") {
    const record = saveDemoSaasModules(demoTenantId(ctx), saasId, [
      {
        id,
        saas_id: saasId,
        code: input.code,
        label: input.label,
        phase: input.phase,
        status: input.status,
        importance: input.importance,
        description: input.description ?? null,
      },
    ])[0];
    return mapModuleRow(record);
  }
  try {
    await run(
      `INSERT INTO saas_modules (id, tenant_id, saas_id, code, label, phase, status, importance, description, created_at, updated_at)
       VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
       ON CONFLICT(tenant_id, saas_id, code) DO UPDATE SET
         label = excluded.label,
         phase = excluded.phase,
         status = excluded.status,
         importance = excluded.importance,
         description = excluded.description,
         updated_at = excluded.updated_at`,
      id,
      ctx.tenantId,
      saasId,
      input.code,
      input.label,
      input.phase,
      input.status,
      input.importance,
      input.description ?? null,
      now,
      now,
    );
    const rows = await queryAll<ModuleRow>(
      `SELECT id, tenant_id, saas_id, code, label, phase, status, importance, description, created_at, updated_at
       FROM saas_modules
       WHERE tenant_id = ? AND saas_id = ? AND code = ?
       LIMIT 1`,
      ctx.tenantId,
      saasId,
      input.code,
    );
    return mapModuleRow(rows[0]);
  } catch (error) {
    if (shouldFallbackToDemo(error, ctx)) {
      const record = saveDemoSaasModules(demoTenantId(ctx), saasId, [
        {
          id,
          saas_id: saasId,
          code: input.code,
          label: input.label,
          phase: input.phase,
          status: input.status,
          importance: input.importance,
          description: input.description ?? null,
        },
      ])[0];
      return mapModuleRow(record);
    }
    throw error;
  }
}

export async function listSaasInterviewAnswers(ctx: BlueprintsContext, saasId: string): Promise<SaasInterviewAnswer[]> {
  if (ctx.mode === "demo") {
    return listDemoSaasInterviewAnswers(demoTenantId(ctx), saasId).map(mapInterviewRow);
  }
  try {
    const rows = await queryAll<InterviewRow>(
      `SELECT id, tenant_id, saas_id, question_code, answer_text, metadata, created_at
       FROM saas_interview_answers
       WHERE tenant_id = ? AND saas_id = ?
       ORDER BY datetime(created_at) DESC`,
      ctx.tenantId,
      saasId,
    );
    return rows.map(mapInterviewRow);
  } catch (error) {
    if (shouldFallbackToDemo(error, ctx)) {
      return listDemoSaasInterviewAnswers(demoTenantId(ctx), saasId).map(mapInterviewRow);
    }
    throw error;
  }
}

export async function recordInterviewAnswers(
  ctx: BlueprintsContext,
  saasId: string,
  answers: Array<{ questionCode: string; answerText: string; metadata?: Record<string, unknown> }>,
): Promise<SaasInterviewAnswer[]> {
  const now = new Date().toISOString();
  if (ctx.mode === "demo") {
    return recordDemoSaasInterviewAnswers(demoTenantId(ctx), saasId, answers.map((answer) => ({
      question_code: answer.questionCode,
      answer_text: answer.answerText,
      metadata: answer.metadata ? JSON.stringify(answer.metadata) : null,
    }))).map(mapInterviewRow);
  }
  const inserts = await Promise.all(
    answers.map(async (answer) => {
      const id = `${Date.now()}_${Math.random().toString(16).slice(2)}`;
      await run(
        `INSERT INTO saas_interview_answers (id, tenant_id, saas_id, question_code, answer_text, metadata, created_at)
         VALUES (?, ?, ?, ?, ?, ?, ?)`,
        id,
        ctx.tenantId,
        saasId,
        answer.questionCode,
        answer.answerText,
        answer.metadata ? JSON.stringify(answer.metadata) : null,
        now,
      );
      return {
        id,
        tenant_id: ctx.tenantId,
        saas_id: saasId,
        question_code: answer.questionCode,
        answer_text: answer.answerText,
        metadata: answer.metadata ? JSON.stringify(answer.metadata) : null,
        created_at: now,
      };
    }),
  );
  return inserts.map(mapInterviewRow);
}

const MODULE_CATALOG: Record<SaasModuleCode, { label: string; description: string }> = {
  ECONOMY: { label: "Economy Engine", description: "Servicios, inventario y pricing." },
  HR: { label: "HR & Fairness", description: "Contratos, horarios y cumplimiento." },
  EMAIL_INTAKE: { label: "Email Intake", description: "Facturas y ahorro en proveedores." },
  SOCIAL: { label: "Social Engine", description: "Campañas y conversion social." },
  APPOINTMENTS: { label: "Appointments", description: "Agenda y citas." },
  CUSTOMERS: { label: "Customers", description: "Clientes y perfiles." },
  CLIENT_PORTAL: { label: "Client Portal", description: "Portal publico con booking." },
  STAFF_PORTAL: { label: "Staff Portal", description: "Panel operativo del equipo." },
  DOMAINS: { label: "Domains", description: "Dominios publicos del SaaS." },
  OWNER_CONTROL: { label: "Owner Control", description: "Snapshot ejecutivo." },
  AUTOPILOT: { label: "Autopilot", description: "Playbook diario del owner." },
};

export function buildRecommendedModulesFromInterview(input: {
  businessType: BusinessType;
  staffCount: number;
  averageTicket: number;
  hasSocial: boolean;
  hasEmailIntake: boolean;
  mainPain: string;
  primaryGoal: BlueprintPrimaryGoal;
}): SaasModule[] {
  const now = new Date().toISOString();
  const modules: SaasModule[] = [];
  const pushModule = (code: SaasModuleCode, phase: number, status: SaasModuleStatus, importance: number) => {
    modules.push({
      id: `module_${code.toLowerCase()}_${Date.now()}_${Math.random().toString(16).slice(2)}`,
      tenantId: "",
      saasId: "",
      code,
      label: MODULE_CATALOG[code].label,
      phase,
      status,
      importance,
      description: MODULE_CATALOG[code].description,
      createdAt: now,
      updatedAt: now,
    });
  };

  if (input.businessType === "SALON" && input.primaryGoal === "FILL_AGENDA") {
    pushModule("DOMAINS", 0, "ACTIVE", 3);
    pushModule("OWNER_CONTROL", 0, "ACTIVE", 3);
    pushModule("APPOINTMENTS", 1, "ACTIVE", 3);
    pushModule("CUSTOMERS", 1, "ACTIVE", 2);
    pushModule("CLIENT_PORTAL", 1, "ACTIVE", 2);
    pushModule("STAFF_PORTAL", 1, "ACTIVE", 2);
    pushModule("ECONOMY", 2, "PLANNED", 3);
    pushModule("HR", 2, "PLANNED", 3);
    pushModule("EMAIL_INTAKE", 2, input.hasEmailIntake ? "ACTIVE" : "PLANNED", 2);
    pushModule("SOCIAL", 2, input.hasSocial ? "ACTIVE" : "PLANNED", 2);
    pushModule("AUTOPILOT", 3, "PLANNED", 3);
  }

  if (input.primaryGoal === "MAX_MARGIN") {
    ["ECONOMY", "EMAIL_INTAKE", "HR", "OWNER_CONTROL"].forEach((code) => {
      const modItem = modules.find((mod) => mod.code === code);
      if (modItem) {
        modItem.importance = 3;
        modItem.status = modItem.status === "DISABLED" ? "PLANNED" : modItem.status;
      } else {
        pushModule(code as SaasModuleCode, 2, "PLANNED", 3);
      }
    });
  }

  if (input.mainPain === "AGENDA_VACIA") {
    ["SOCIAL", "CLIENT_PORTAL", "APPOINTMENTS"].forEach((code) => {
      const modItem = modules.find((mod) => mod.code === code);
      if (modItem) modItem.importance = 3;
    });
  }

  if (input.staffCount >= 5) {
    const modItem = modules.find((mod) => mod.code === "HR");
    if (modItem) modItem.importance = 3;
  }

  if (input.averageTicket > 80) {
    const modItem = modules.find((mod) => mod.code === "ECONOMY");
    if (modItem) modItem.importance = 3;
  }

  return modules;
}

export async function applyInterviewToBlueprint(
  ctx: BlueprintsContext,
  saasId: string,
  input: {
    businessType: BusinessType;
    staffCount: number;
    averageTicket: number;
    hasSocial: boolean;
    hasEmailIntake: boolean;
    mainPain: string;
    primaryGoal: BlueprintPrimaryGoal;
    maturityStage: BlueprintMaturityStage;
  },
): Promise<{ blueprint: SaasBlueprint; modules: SaasModule[] }> {
  const answers: Array<{ questionCode: string; answerText: string; metadata?: Record<string, unknown> }> = [
    { questionCode: "BUSINESS_TYPE", answerText: input.businessType },
    { questionCode: "STAFF_COUNT", answerText: String(input.staffCount) },
    { questionCode: "AVERAGE_TICKET", answerText: String(input.averageTicket) },
    { questionCode: "HAS_SOCIAL", answerText: input.hasSocial ? "YES" : "NO" },
    { questionCode: "HAS_EMAIL_INTAKE", answerText: input.hasEmailIntake ? "YES" : "NO" },
    { questionCode: "MAIN_PAIN", answerText: input.mainPain },
  ];
  await recordInterviewAnswers(ctx, saasId, answers);

  const blueprint = await upsertSaasBlueprint(ctx, {
    saasId,
    businessType: input.businessType,
    primaryGoal: input.primaryGoal,
    maturityStage: input.maturityStage,
    notes: null,
  });

  const recommended = buildRecommendedModulesFromInterview({
    businessType: input.businessType,
    staffCount: input.staffCount,
    averageTicket: input.averageTicket,
    hasSocial: input.hasSocial,
    hasEmailIntake: input.hasEmailIntake,
    mainPain: input.mainPain,
    primaryGoal: input.primaryGoal,
  });

  const existing = await listSaasModules(ctx, saasId);
  const merged = recommended.map((modItem) => {
    const current = existing.find((item) => item.code === modItem.code);
    if (!current) return modItem;
    return {
      ...modItem,
      id: current.id,
      status: current.status === "ACTIVE" ? "ACTIVE" : modItem.status,
      importance: Math.max(current.importance, modItem.importance),
      createdAt: current.createdAt,
      updatedAt: modItem.updatedAt,
    };
  });

  const savedModules: SaasModule[] = [];
  for (const modItem of merged) {
    const saved = await upsertSaasModule(ctx, {
      id: modItem.id,
      saasId,
      code: modItem.code,
      label: modItem.label,
      phase: modItem.phase,
      status: modItem.status,
      importance: modItem.importance,
      description: modItem.description ?? null,
    });
    savedModules.push(saved);
  }

  const mergedCodes = new Set(savedModules.map((item) => item.code));
  existing
    .filter((item) => !mergedCodes.has(item.code))
    .forEach((item) => savedModules.push(item));

  return { blueprint, modules: savedModules };
}
