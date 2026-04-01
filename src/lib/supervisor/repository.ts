/**
 * Technical Supervisor Agent V1: Repository Layer
 * 
 * Acceso a datos de incidentes técnicos
 * - Persistencia real en D1
 * - Patrón canónico de Drako
 */

import { getDb } from "@/lib/db";
import { randomUUID } from "crypto";
import type {
  Incident,
  IncidentPayload,
  IncidentRecommendation,
  IncidentQueryFilter,
  IncidentSeverity,
  IncidentCategory,
  IncidentStatus,
} from "./types";

export class SupervisorRepository {
  private db: D1Database;

  constructor(db?: D1Database) {
    this.db = db || getDb();
  }

  /**
   * Crea un nuevo incidente
   */
  async createIncident(
    payload: IncidentPayload,
    severity: IncidentSeverity,
    category: IncidentCategory
  ): Promise<Incident> {
    const id = randomUUID();
    const now = new Date().toISOString();

    const metadataJson = payload.metadata ? JSON.stringify(payload.metadata) : null;

    await this.db
      .prepare(
        `INSERT INTO supervisor_incidents (
          id, source, title, description, severity, category, status,
          correlation_id, affected_service, metadata, created_at, updated_at
        ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`
      )
      .bind(
        id,
        payload.source,
        payload.title,
        payload.description,
        severity,
        category,
        "open",
        payload.correlationId || null,
        payload.affectedService || null,
        metadataJson,
        now,
        now
      )
      .run();

    return {
      id,
      severity,
      category,
      status: "open",
      createdAt: now,
      updatedAt: now,
      ...payload,
    };
  }

  /**
   * Obtiene un incidente por ID
   */
  async getIncidentById(id: string): Promise<Incident | null> {
    const result = await this.db
      .prepare(
        `SELECT id, source, title, description, severity, category, status,
                correlation_id, affected_service, metadata, created_at, updated_at, resolved_at
         FROM supervisor_incidents
         WHERE id = ?`
      )
      .bind(id)
      .first<any>();

    if (!result) return null;

    return this.mapRowToIncident(result);
  }

  /**
   * Lista incidentes con filtros
   */
  async listIncidents(filter: IncidentQueryFilter = {}): Promise<Incident[]> {
    let query = `SELECT id, source, title, description, severity, category, status,
                        correlation_id, affected_service, metadata, created_at, updated_at, resolved_at
                 FROM supervisor_incidents
                 WHERE 1=1`;

    const params: any[] = [];

    if (filter.status) {
      query += ` AND status = ?`;
      params.push(filter.status);
    }

    if (filter.severity) {
      query += ` AND severity = ?`;
      params.push(filter.severity);
    }

    if (filter.category) {
      query += ` AND category = ?`;
      params.push(filter.category);
    }

    if (filter.source) {
      query += ` AND source = ?`;
      params.push(filter.source);
    }

    if (filter.affectedService) {
      query += ` AND affected_service = ?`;
      params.push(filter.affectedService);
    }

    if (filter.createdAfter) {
      query += ` AND created_at >= ?`;
      params.push(filter.createdAfter);
    }

    if (filter.createdBefore) {
      query += ` AND created_at <= ?`;
      params.push(filter.createdBefore);
    }

    query += ` ORDER BY created_at DESC`;

    if (filter.limit) {
      query += ` LIMIT ?`;
      params.push(filter.limit);
    }

    if (filter.offset) {
      query += ` OFFSET ?`;
      params.push(filter.offset);
    }

    const result = await this.db.prepare(query).bind(...params).all<any>();

    return (result.results ?? []).map((row) => this.mapRowToIncident(row));
  }

  /**
   * Actualiza estado de un incidente
   */
  async updateIncidentStatus(id: string, status: IncidentStatus): Promise<void> {
    const now = new Date().toISOString();
    const resolvedAt = status === "resolved" ? now : null;

    await this.db
      .prepare(
        `UPDATE supervisor_incidents
         SET status = ?, updated_at = ?, resolved_at = ?
         WHERE id = ?`
      )
      .bind(status, now, resolvedAt, id)
      .run();
  }

  /**
   * Crea una recomendación para un incidente
   */
  async createRecommendation(
    incidentId: string,
    probableCause: string,
    recommendedAction: string,
    urgency: "immediate" | "soon" | "later",
    ownerSurface: string
  ): Promise<IncidentRecommendation> {
    const id = randomUUID();
    const now = new Date().toISOString();

    await this.db
      .prepare(
        `INSERT INTO supervisor_recommendations (
          id, incident_id, probable_cause, recommended_action, urgency, owner_surface, created_at
        ) VALUES (?, ?, ?, ?, ?, ?, ?)`
      )
      .bind(id, incidentId, probableCause, recommendedAction, urgency, ownerSurface, now)
      .run();

    return {
      id,
      incidentId,
      probableCause,
      recommendedAction,
      urgency,
      ownerSurface: ownerSurface as any,
      createdAt: now,
    };
  }

  /**
   * Obtiene recomendaciones para un incidente
   */
  async getRecommendationsByIncidentId(incidentId: string): Promise<IncidentRecommendation[]> {
    const result = await this.db
      .prepare(
        `SELECT id, incident_id, probable_cause, recommended_action, urgency, owner_surface, created_at
         FROM supervisor_recommendations
         WHERE incident_id = ?
         ORDER BY created_at DESC`
      )
      .bind(incidentId)
      .all<any>();

    return (result.results ?? []).map((row) => ({
      id: row.id,
      incidentId: row.incident_id,
      probableCause: row.probable_cause,
      recommendedAction: row.recommended_action,
      urgency: row.urgency,
      ownerSurface: row.owner_surface,
      createdAt: row.created_at,
    }));
  }

  /**
   * Obtiene incidentes críticos abiertos
   */
  async getCriticalOpenIncidents(): Promise<Incident[]> {
    return this.listIncidents({
      severity: "critical",
      status: "open",
      limit: 100,
    });
  }

  /**
   * Mapea fila de D1 a objeto Incident
   */
  private mapRowToIncident(row: any): Incident {
    return {
      id: row.id,
      source: row.source,
      title: row.title,
      description: row.description,
      severity: row.severity,
      category: row.category,
      status: row.status,
      correlationId: row.correlation_id,
      affectedService: row.affected_service,
      metadata: row.metadata ? JSON.parse(row.metadata) : undefined,
      createdAt: row.created_at,
      updatedAt: row.updated_at,
      resolvedAt: row.resolved_at,
    };
  }
}
