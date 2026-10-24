/**
 * Public API for observability-core.
 *
 * This surface intentionally includes only the reusable observability domain:
 * correlation, activities, incidents, health snapshots, and operational
 * summaries. Neighbor systems such as empire/events, factory incidents,
 * supervisor incidents, and db/health are not part of this barrel.
 */
export {
  CORRELATION_HEADER,
  TENANT_HEADER,
  SAAS_HEADER,
  CORRELATION_ID_REGEX,
  generateCorrelationId,
  isValidCorrelationId,
  normalizeCorrelationId,
  shouldBypassCorrelation,
} from "@/lib/correlation";

export type {
  ObservabilitySourceType,
  ObservabilityActivityStatus,
  ObservabilityIncidentSeverity,
  ObservabilityIncidentStatus,
  ObservabilityHealthStatus,
  ObservabilityFreshnessStatus,
  ObservabilityJson,
  ObservabilityActivity,
  RecordObservabilityActivityInput,
  ObservabilityIncident,
  OpenObservabilityIncidentInput,
  ObservabilityHealthSnapshot,
  CaptureHealthSnapshotInput,
  ObservabilityStatusSummary,
} from "@/lib/observability-core/types";
export { ObservabilityCoreError } from "@/lib/observability-core/types";

export {
  recordObservabilityActivity,
  listObservabilityActivities,
} from "@/lib/observability-core/activities";

export {
  openObservabilityIncident,
  acknowledgeObservabilityIncident,
  resolveObservabilityIncident,
  resolveObservabilityIncidentsByScope,
  listObservabilityIncidents,
} from "@/lib/observability-core/incidents";

export {
  captureHealthSnapshot,
  getLatestHealthSnapshot,
  listHealthSnapshots,
} from "@/lib/observability-core/health";

export {
  deriveObservabilityStatusSummary,
  getObservabilityStatusSummary,
} from "@/lib/observability-core/summary";
