export type BusinessType = "SALON" | "CLINIC" | "LAUNDRY" | "PET_CARE" | "OTHER";

export type BlueprintPrimaryGoal = "FILL_AGENDA" | "MAX_MARGIN" | "SCALE" | "STABILIZE";

export type BlueprintMaturityStage = "STARTER" | "GROWTH" | "PRO" | "MULTI_SITE";

export type SaasModuleCode =
  | "ECONOMY"
  | "HR"
  | "EMAIL_INTAKE"
  | "SOCIAL"
  | "APPOINTMENTS"
  | "CUSTOMERS"
  | "CLIENT_PORTAL"
  | "STAFF_PORTAL"
  | "DOMAINS"
  | "OWNER_CONTROL"
  | "AUTOPILOT";

export type SaasModuleStatus = "ACTIVE" | "PLANNED" | "DISABLED";

export type SaasBlueprint = {
  id: string;
  tenantId: string;
  saasId: string;
  businessType: BusinessType;
  primaryGoal: BlueprintPrimaryGoal;
  maturityStage: BlueprintMaturityStage;
  notes?: string;
  createdAt: string;
  updatedAt: string;
};

export type SaasModule = {
  id: string;
  tenantId: string;
  saasId: string;
  code: SaasModuleCode;
  label: string;
  phase: number;
  status: SaasModuleStatus;
  importance: number;
  description?: string;
  createdAt: string;
  updatedAt: string;
};

export type SaasInterviewAnswer = {
  id: string;
  tenantId: string;
  saasId: string;
  questionCode: string;
  answerText: string;
  metadata?: Record<string, unknown>;
  createdAt: string;
};

export type SaasBlueprintWithModules = {
  blueprint: SaasBlueprint;
  modules: SaasModule[];
};
