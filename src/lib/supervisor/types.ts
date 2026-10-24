/**
 * Technical Supervisor Agent V1: Type Definitions
 * 
 * Tipos canónicos para incidentes técnicos del sistema Drako
 * - Persistencia real en D1
 * - Clasificación por severidad y categoría
 * - Base para automatización futura
 */

export type IncidentSource =
  | "ci_cd"
  | "test_suite"
  | "build_system"
  | "runtime_health"
  | "smoke_check"
  | "internal_error"
  | "api_error"
  | "database_error"
  | "worker_error"
  | "deployment_error";

export type IncidentSeverity = "low" | "medium" | "high" | "critical";

export type IncidentStatus = "open" | "investigating" | "resolved" | "acknowledged" | "escalated";

export type IncidentCategory =
  | "regression"
  | "performance"
  | "availability"
  | "data_integrity"
  | "security"
  | "configuration"
  | "dependency"
  | "infrastructure"
  | "unknown";

export type ServiceSurface =
  | "campamento_base"
  | "drako_factory"
  | "mentoria"
  | "socialflow"
  | "billing"
  | "auth"
  | "api"
  | "workers"
  | "database"
  | "infrastructure"
  | "unknown";

export interface IncidentPayload {
  source: IncidentSource;
  title: string;
  description: string;
  metadata?: Record<string, unknown>;
  correlationId?: string;
  affectedService?: ServiceSurface;
}

export interface Incident extends IncidentPayload {
  id: string;
  severity: IncidentSeverity;
  category: IncidentCategory;
  status: IncidentStatus;
  createdAt: string;
  updatedAt: string;
  resolvedAt?: string;
}

export interface IncidentRecommendation {
  id: string;
  incidentId: string;
  probableCause: string;
  recommendedAction: string;
  urgency: "immediate" | "soon" | "later";
  ownerSurface: ServiceSurface;
  createdAt: string;
}

export interface IncidentQueryFilter {
  status?: IncidentStatus;
  severity?: IncidentSeverity;
  category?: IncidentCategory;
  source?: IncidentSource;
  affectedService?: ServiceSurface;
  createdAfter?: string;
  createdBefore?: string;
  limit?: number;
  offset?: number;
}
