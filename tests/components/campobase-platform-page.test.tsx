import React from "react";
import { beforeEach, describe, expect, it, vi } from "vitest";
import { fireEvent, render, screen, waitFor } from "@testing-library/react";
import "@testing-library/jest-dom";

import PlatformOperatorControlSurface from "@/components/campobase/PlatformOperatorControlSurface";

const replaceMock = vi.fn();
const fetchMock = vi.spyOn(global, "fetch");

vi.mock("next/navigation", () => ({
  useRouter: () => ({
    replace: replaceMock,
  }),
}));

globalThis.React = React;

const baseSurface = {
  tenantId: "tenant_socialflow",
  saasId: "socialflow",
  summary: {
    tenantId: "tenant_socialflow",
    saasId: "socialflow",
    overallStatus: "healthy",
    freshnessStatus: "fresh",
    openIncidentsCount: 1,
    latestActivityAt: "2024-01-03T00:00:00.000Z",
    latestSnapshotAt: "2024-01-03T00:05:00.000Z",
    recommendation: "Review 1 open incident(s).",
  },
  latestHealthSnapshot: {
    id: "health_1",
    tenantId: "tenant_socialflow",
    saasId: "socialflow",
    scopeType: "saas",
    scopeKey: "socialflow",
    healthStatus: "healthy",
    freshnessStatus: "fresh",
    lastActivityAt: "2024-01-03T00:00:00.000Z",
    openIncidentsCount: 1,
    summary: "Healthy",
    capturedAt: "2024-01-03T00:05:00.000Z",
  },
  openIncidents: [
    {
      id: "incident_1",
      tenantId: "tenant_socialflow",
      saasId: "socialflow",
      sourceType: "integration",
      sourceKey: "linkedin",
      incidentType: "integration_connection_invalid",
      severity: "high",
      status: "OPEN",
      summary: "LinkedIn token expired",
      details: null,
      openedAt: "2024-01-03T00:00:00.000Z",
      resolvedAt: null,
      updatedAt: "2024-01-03T00:00:00.000Z",
    },
  ],
  recentActivity: [
    {
      id: "activity_1",
      tenantId: "tenant_socialflow",
      saasId: "socialflow",
      sourceType: "automation",
      sourceKey: "socialflow.content_generation",
      activityType: "automation_execution",
      status: "success",
      summary: "Automation ran successfully.",
      metadata: null,
      createdAt: "2024-01-03T00:00:00.000Z",
    },
  ],
  automations: [
    {
      automationKey: "socialflow.content_generation",
      displayName: "SocialFlow content generation",
      enabled: true,
      frequencyLabel: "2 / weeks",
      configSummary: "niche: fitness | tone: direct",
      lastExecutionAt: "2024-01-03T00:00:00.000Z",
      lastResult: "SUCCESS",
      lastSummary: "Generated campaign successfully",
    },
    {
      automationKey: "socialflow.health_check",
      displayName: "SocialFlow health check",
      enabled: false,
      frequencyLabel: "Manual",
      configSummary: "tone: operational",
      lastExecutionAt: null,
      lastResult: "NEVER",
      lastSummary: null,
    },
  ],
  integrations: [
    {
      integrationKey: "linkedin",
      status: "CONNECTED",
      lastValidatedAt: "2024-01-03T00:00:00.000Z",
      lastError: null,
    },
  ],
};

function jsonResponse(data: unknown, status = 200) {
  return new Response(JSON.stringify(data), {
    status,
    headers: { "Content-Type": "application/json" },
  });
}

describe("Platform operator control surface", () => {
  beforeEach(() => {
    fetchMock.mockReset();
    replaceMock.mockReset();
  });

  it("loads initial surface for tenant + saas", async () => {
    fetchMock.mockResolvedValueOnce(jsonResponse({ surface: baseSurface }));

    render(React.createElement(PlatformOperatorControlSurface, {
      initialTenantId: "tenant_socialflow",
      initialSaasId: "socialflow",
    }));

    await screen.findByText("SocialFlow content generation");
    expect(fetchMock).toHaveBeenCalledWith(
      "/api/campobase/platform?tenantId=tenant_socialflow&saasId=socialflow",
      { cache: "no-store" },
    );
    expect(screen.getByText("linkedin")).toBeInTheDocument();
    expect(screen.getByText("integration_connection_invalid")).toBeInTheDocument();
  });

  it("runs automation and updates the surface", async () => {
    fetchMock
      .mockResolvedValueOnce(jsonResponse({ surface: baseSurface }))
      .mockResolvedValueOnce(jsonResponse({
        action: "run_automation",
        result: { ok: true },
        surface: baseSurface,
      }));

    render(React.createElement(PlatformOperatorControlSurface, {
      initialTenantId: "tenant_socialflow",
      initialSaasId: "socialflow",
    }));

    await screen.findByText("SocialFlow content generation");
    fireEvent.click(screen.getByRole("button", { name: "Run now" }));

    await waitFor(() => expect(fetchMock).toHaveBeenCalledTimes(2));

    const postCall = fetchMock.mock.calls[1];
    expect(postCall[0]).toBe("/api/campobase/platform");
    expect(postCall[1]?.method).toBe("POST");
    expect(JSON.parse(postCall[1]?.body as string)).toEqual({
      action: "run_automation",
      tenantId: "tenant_socialflow",
      saasId: "socialflow",
      automationKey: "socialflow.content_generation",
    });
  });

  it("validates an integration and refreshes state", async () => {
    fetchMock
      .mockResolvedValueOnce(jsonResponse({ surface: baseSurface }))
      .mockResolvedValueOnce(jsonResponse({
        action: "validate_integration",
        result: { ok: true },
        surface: baseSurface,
      }));

    render(React.createElement(PlatformOperatorControlSurface, {
      initialTenantId: "tenant_socialflow",
      initialSaasId: "socialflow",
    }));

    await screen.findByText("linkedin");
    fireEvent.click(screen.getByRole("button", { name: "Validate" }));

    await waitFor(() => expect(fetchMock).toHaveBeenCalledTimes(2));

    const postCall = fetchMock.mock.calls[1];
    expect(JSON.parse(postCall[1]?.body as string)).toEqual({
      action: "validate_integration",
      tenantId: "tenant_socialflow",
      saasId: "socialflow",
      integrationKey: "linkedin",
    });
  });

  it("submits tenant + saas identity from the inspect form", async () => {
    fetchMock.mockResolvedValueOnce(jsonResponse({ surface: baseSurface }));

    render(React.createElement(PlatformOperatorControlSurface));

    fireEvent.change(screen.getByLabelText("Tenant ID"), { target: { value: "tenant_socialflow" } });
    fireEvent.change(screen.getByLabelText("SaaS ID"), { target: { value: "socialflow" } });
    fireEvent.click(screen.getByRole("button", { name: "Inspect" }));

    await waitFor(() => expect(replaceMock).toHaveBeenCalledWith("/campobase/platform?tenantId=tenant_socialflow&saasId=socialflow"));
    expect(fetchMock).toHaveBeenCalledWith(
      "/api/campobase/platform?tenantId=tenant_socialflow&saasId=socialflow",
      { cache: "no-store" },
    );
  });
});
