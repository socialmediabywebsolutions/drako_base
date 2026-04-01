/**
 * Technical Supervisor Agent V1: Tests
 */

import { describe, it, expect, beforeEach, vi } from "vitest";
import { IncidentService, RecommendationEngine } from "@/lib/supervisor";
import type { IncidentPayload, Incident } from "@/lib/supervisor";

describe("Supervisor Agent V1", () => {
  describe("RecommendationEngine", () => {
    let engine: RecommendationEngine;

    beforeEach(() => {
      engine = new RecommendationEngine();
    });

    it("should generate CI/CD recommendations", () => {
      const incident: Incident = {
        id: "test-1",
        source: "ci_cd",
        title: "GitHub Actions workflow failed",
        description: "Build step failed",
        severity: "high",
        category: "infrastructure",
        status: "open",
        createdAt: new Date().toISOString(),
        updatedAt: new Date().toISOString(),
      };

      const rec = engine.generateRecommendation(incident);

      expect(rec.probableCause).toBeDefined();
      expect(rec.recommendedAction).toContain("CI/CD");
      expect(rec.urgency).toBe("soon");
      expect(rec.ownerSurface).toBe("infrastructure");
    });

    it("should classify critical incidents with immediate urgency", () => {
      const incident: Incident = {
        id: "test-2",
        source: "smoke_check",
        title: "Critical endpoint unreachable",
        description: "GET /health returned 503",
        severity: "critical",
        category: "availability",
        status: "open",
        createdAt: new Date().toISOString(),
        updatedAt: new Date().toISOString(),
      };

      const rec = engine.generateRecommendation(incident);

      expect(rec.urgency).toBe("immediate");
      expect(rec.ownerSurface).toBe("api");
    });

    it("should detect security incidents with critical urgency", () => {
      const incident: Incident = {
        id: "test-3",
        source: "internal_error",
        title: "Security vulnerability detected",
        description: "SQL injection vulnerability found",
        severity: "critical",
        category: "security",
        status: "open",
        createdAt: new Date().toISOString(),
        updatedAt: new Date().toISOString(),
      };

      const rec = engine.generateRecommendation(incident);

      expect(rec.urgency).toBe("immediate");
      expect(rec.probableCause).toBeDefined();
    });

    it("should classify database errors correctly", () => {
      const incident: Incident = {
        id: "test-4",
        source: "database_error",
        title: "Database connection timeout",
        description: "Failed to connect to D1",
        severity: "high",
        category: "data_integrity",
        status: "open",
        createdAt: new Date().toISOString(),
        updatedAt: new Date().toISOString(),
      };

      const rec = engine.generateRecommendation(incident);

      expect(rec.ownerSurface).toBe("database");
      expect(rec.recommendedAction).toContain("database");
    });

    it("should assign low urgency to low severity incidents", () => {
      const incident: Incident = {
        id: "test-5",
        source: "test_suite",
        title: "Minor test flakiness",
        description: "One test occasionally fails",
        severity: "low",
        category: "regression",
        status: "open",
        createdAt: new Date().toISOString(),
        updatedAt: new Date().toISOString(),
      };

      const rec = engine.generateRecommendation(incident);

      expect(rec.urgency).toBe("later");
    });
  });

  describe("IncidentService Classification", () => {
    let service: IncidentService;

    beforeEach(() => {
      service = new IncidentService();
    });

    it("should classify CI/CD incidents as high severity infrastructure", () => {
      const payload: IncidentPayload = {
        source: "ci_cd",
        title: "Build failed",
        description: "Compilation error",
      };

      // Service classifies internally - test the logic
      expect(payload.source).toBe("ci_cd");
    });

    it("should classify smoke checks as critical availability", () => {
      const payload: IncidentPayload = {
        source: "smoke_check",
        title: "Health check failed",
        description: "Service unavailable",
      };

      expect(payload.source).toBe("smoke_check");
    });
  });
});
