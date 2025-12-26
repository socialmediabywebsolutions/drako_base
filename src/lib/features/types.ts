export type SaasFeatureKey =
  | "ECONOMY"
  | "HR"
  | "EMPLOYEES"
  | "STAFF_PORTAL"
  | "CLIENT_PORTAL"
  | "EMAIL_INTAKE"
  | "SOCIAL"
  | "OWNER_CONTROL"
  | "TASKS"
  | "KNOWLEDGE"
  | "BLUEPRINT"
  | "APPEARANCE_BRANDING"
  | "TAX_ENGINE";

export type SaasFeatureStatus = "ENABLED" | "DISABLED" | "PLANNED" | "DEPRECATED";

export type SaasFeatureCategory = "CORE" | "OPERATIONS" | "MARKETING" | "ANALYTICS";

export type SaasFeatureSource = "BLUEPRINT" | "MANUAL" | "AUTOPILOT" | "PLAN";

export interface SaasFeature {
  id: string;
  tenantId: string;
  saasId: string;
  featureKey: SaasFeatureKey;
  label: string;
  category: SaasFeatureCategory;
  status: SaasFeatureStatus;
  source: SaasFeatureSource;
  phaseOrder: number;
  metadata?: Record<string, unknown> | null;
  createdAt: string;
  updatedAt: string;
}

export interface UpsertSaasFeatureInput {
  tenantId: string;
  saasId: string;
  featureKey: SaasFeatureKey;
  label?: string;
  category?: SaasFeatureCategory;
  status?: SaasFeatureStatus;
  source?: SaasFeatureSource;
  phaseOrder?: number;
  metadata?: Record<string, unknown> | null;
}
