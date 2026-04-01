/**
 * Technical Supervisor Agent V1: Recommendation Engine
 * 
 * Lógica de clasificación y recomendaciones
 * - Mapea incidentes a causas probables
 * - Sugiere acciones recomendadas
 * - Asigna urgencia y propietario
 */

import type {
  Incident,
  IncidentCategory,
  IncidentSeverity,
  IncidentSource,
  ServiceSurface,
} from "./types";

export interface RecommendationOutput {
  probableCause: string;
  recommendedAction: string;
  urgency: "immediate" | "soon" | "later";
  ownerSurface: ServiceSurface;
}

export class RecommendationEngine {
  /**
   * Genera recomendación basada en incidente
   */
  generateRecommendation(incident: Incident): RecommendationOutput {
    // Clasificación por source
    const sourceRecommendation = this.classifyBySource(incident.source);

    // Clasificación por severity
    const severityRecommendation = this.classifyBySeverity(incident.severity);

    // Clasificación por category
    const categoryRecommendation = this.classifyByCategory(incident.category);

    // Merge de recomendaciones
    return this.mergeRecommendations(
      sourceRecommendation,
      severityRecommendation,
      categoryRecommendation,
      incident.affectedService
    );
  }

  /**
   * Clasifica por fuente de incidente
   */
  private classifyBySource(source: IncidentSource): Partial<RecommendationOutput> {
    const sourceMap: Record<IncidentSource, Partial<RecommendationOutput>> = {
      ci_cd: {
        probableCause: "CI/CD pipeline failure detected",
        recommendedAction: "Review CI/CD logs and check for dependency/build issues",
        ownerSurface: "infrastructure",
      },
      test_suite: {
        probableCause: "Test suite regression or flaky test",
        recommendedAction: "Run tests locally, check for environment-specific issues",
        ownerSurface: "api",
      },
      build_system: {
        probableCause: "Build system error or misconfiguration",
        recommendedAction: "Check build logs, verify dependencies, rebuild from scratch",
        ownerSurface: "infrastructure",
      },
      runtime_health: {
        probableCause: "Runtime health check failure",
        recommendedAction: "Monitor runtime metrics, check for resource exhaustion",
        ownerSurface: "infrastructure",
      },
      smoke_check: {
        probableCause: "Smoke test failure indicates critical functionality broken",
        recommendedAction: "Verify critical endpoints, check recent deployments",
        ownerSurface: "api",
      },
      internal_error: {
        probableCause: "Internal application error",
        recommendedAction: "Check error logs, trace stack, identify error source",
        ownerSurface: "api",
      },
      api_error: {
        probableCause: "API endpoint error or timeout",
        recommendedAction: "Check API logs, verify database connectivity, check rate limits",
        ownerSurface: "api",
      },
      database_error: {
        probableCause: "Database connectivity or query error",
        recommendedAction: "Check database health, verify connection pool, review queries",
        ownerSurface: "database",
      },
      worker_error: {
        probableCause: "Cloudflare Worker error or timeout",
        recommendedAction: "Check worker logs, verify bindings, check execution time",
        ownerSurface: "workers",
      },
      deployment_error: {
        probableCause: "Deployment process failure",
        recommendedAction: "Review deployment logs, verify configuration, check rollback status",
        ownerSurface: "infrastructure",
      },
    };

    return sourceMap[source] || { ownerSurface: "unknown" };
  }

  /**
   * Clasifica por severidad
   */
  private classifyBySeverity(severity: IncidentSeverity): Partial<RecommendationOutput> {
    const severityMap: Record<IncidentSeverity, Partial<RecommendationOutput>> = {
      low: {
        urgency: "later",
      },
      medium: {
        urgency: "soon",
      },
      high: {
        urgency: "soon",
      },
      critical: {
        urgency: "immediate",
      },
    };

    return severityMap[severity] || { urgency: "later" };
  }

  /**
   * Clasifica por categoría
   */
  private classifyByCategory(category: IncidentCategory): Partial<RecommendationOutput> {
    const categoryMap: Record<IncidentCategory, Partial<RecommendationOutput>> = {
      regression: {
        probableCause: "Recent code change introduced regression",
        recommendedAction: "Review recent commits, run git bisect, revert if necessary",
      },
      performance: {
        probableCause: "Performance degradation detected",
        recommendedAction: "Profile application, check for N+1 queries, optimize hot paths",
      },
      availability: {
        probableCause: "Service availability issue",
        recommendedAction: "Check service health, verify uptime, review deployment status",
      },
      data_integrity: {
        probableCause: "Data integrity violation detected",
        recommendedAction: "Audit database, verify constraints, check for corruption",
      },
      security: {
        probableCause: "Security issue detected",
        recommendedAction: "Isolate affected systems, review security logs, patch immediately",
      },
      configuration: {
        probableCause: "Configuration error or mismatch",
        recommendedAction: "Verify environment variables, check configuration files",
      },
      dependency: {
        probableCause: "Dependency issue or incompatibility",
        recommendedAction: "Check dependency versions, update or downgrade as needed",
      },
      infrastructure: {
        probableCause: "Infrastructure issue",
        recommendedAction: "Check infrastructure health, verify resource allocation",
      },
      unknown: {
        probableCause: "Unknown issue - requires investigation",
        recommendedAction: "Gather more information, enable debug logging, investigate",
      },
    };

    return categoryMap[category] || {};
  }

  /**
   * Merge de recomendaciones con prioridad
   * Prioridad: source > category > default
   */
  private mergeRecommendations(
    sourceRec: Partial<RecommendationOutput>,
    severityRec: Partial<RecommendationOutput>,
    categoryRec: Partial<RecommendationOutput>,
    affectedService?: ServiceSurface
  ): RecommendationOutput {
    return {
      probableCause:
        sourceRec.probableCause ||
        categoryRec.probableCause ||
        "Incident detected - investigation required",
      recommendedAction:
        sourceRec.recommendedAction ||
        categoryRec.recommendedAction ||
        "Review incident details and logs",
      urgency: severityRec.urgency || "later",
      ownerSurface: affectedService || sourceRec.ownerSurface || "unknown",
    };
  }
}
