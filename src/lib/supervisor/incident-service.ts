/**
 * Technical Supervisor Agent V1: Incident Service
 * 
 * Orquestación de ingestión, clasificación y persistencia de incidentes
 * - Recibe eventos técnicos
 * - Clasifica automáticamente
 * - Persiste en D1
 * - Genera recomendaciones
 */

import { SupervisorRepository } from "./repository";
import { RecommendationEngine } from "./recommendation-engine";
import type {
  Incident,
  IncidentPayload,
  IncidentCategory,
  IncidentSeverity,
  IncidentQueryFilter,
} from "./types";

export class IncidentService {
  private repository: SupervisorRepository;
  private recommendationEngine: RecommendationEngine;

  constructor(repository?: SupervisorRepository) {
    this.repository = repository || new SupervisorRepository();
    this.recommendationEngine = new RecommendationEngine();
  }

  /**
   * Ingesta un incidente técnico
   * - Clasifica automáticamente
   * - Persiste en D1
   * - Genera recomendación
   */
  async ingestIncident(payload: IncidentPayload): Promise<{
    incident: Incident;
    recommendation: any;
  }> {
    // Clasificar automáticamente
    const { severity, category } = this.classifyIncident(payload);

    // Crear incidente
    const incident = await this.repository.createIncident(payload, severity, category);

    // Generar recomendación
    const recommendation = this.recommendationEngine.generateRecommendation(incident);
    const persistedRecommendation = await this.repository.createRecommendation(
      incident.id,
      recommendation.probableCause,
      recommendation.recommendedAction,
      recommendation.urgency,
      recommendation.ownerSurface
    );

    return {
      incident,
      recommendation: persistedRecommendation,
    };
  }

  /**
   * Obtiene un incidente por ID con sus recomendaciones
   */
  async getIncidentWithRecommendations(id: string) {
    const incident = await this.repository.getIncidentById(id);
    if (!incident) return null;

    const recommendations = await this.repository.getRecommendationsByIncidentId(id);

    return {
      incident,
      recommendations,
    };
  }

  /**
   * Lista incidentes con filtros
   */
  async listIncidents(filter: IncidentQueryFilter = {}) {
    return this.repository.listIncidents(filter);
  }

  /**
   * Obtiene incidentes críticos abiertos
   */
  async getCriticalOpenIncidents() {
    return this.repository.getCriticalOpenIncidents();
  }

  /**
   * Actualiza estado de un incidente
   */
  async updateIncidentStatus(id: string, status: "open" | "investigating" | "resolved" | "acknowledged" | "escalated") {
    return this.repository.updateIncidentStatus(id, status);
  }

  /**
   * Clasifica un incidente automáticamente
   */
  private classifyIncident(payload: IncidentPayload): {
    severity: IncidentSeverity;
    category: IncidentCategory;
  } {
    let severity: IncidentSeverity = "medium";
    let category: IncidentCategory = "unknown";

    // Clasificación por source
    switch (payload.source) {
      case "ci_cd":
      case "build_system":
      case "deployment_error":
        severity = "high";
        category = "infrastructure";
        break;

      case "test_suite":
        severity = "medium";
        category = "regression";
        break;

      case "smoke_check":
        severity = "critical";
        category = "availability";
        break;

      case "runtime_health":
        severity = "high";
        category = "availability";
        break;

      case "database_error":
        severity = "high";
        category = "data_integrity";
        break;

      case "worker_error":
        severity = "high";
        category = "infrastructure";
        break;

      case "api_error":
        severity = "medium";
        category = "availability";
        break;

      case "internal_error":
        severity = "medium";
        category = "unknown";
        break;
    }

    // Ajuste por palabras clave en título/descripción
    const text = `${payload.title} ${payload.description}`.toLowerCase();

    if (text.includes("security") || text.includes("breach") || text.includes("vulnerability")) {
      severity = "critical";
      category = "security";
    } else if (text.includes("data loss") || text.includes("corruption")) {
      severity = "critical";
      category = "data_integrity";
    } else if (text.includes("performance") || text.includes("slow")) {
      category = "performance";
    } else if (text.includes("regression") || text.includes("broken")) {
      category = "regression";
    } else if (text.includes("config") || text.includes("configuration")) {
      category = "configuration";
    } else if (text.includes("dependency") || text.includes("version")) {
      category = "dependency";
    }

    return { severity, category };
  }
}
