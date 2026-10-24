import React from "react";
import { beforeEach, describe, expect, it, vi } from "vitest";
import { fireEvent, render, screen, waitFor } from "@testing-library/react";
import "@testing-library/jest-dom";

import OperatorSocialFlowPage from "@/app/operator/socialflow/page";
import type {
  CampoBaseSocialAutomationStatusOutput,
  CampoBaseSocialFlowObservability,
} from "@/lib/operator/socialflow-service";

const fetchMock = vi.spyOn(global, "fetch");

globalThis.React = React;

const statusPayload: CampoBaseSocialAutomationStatusOutput = {
  total: 1,
  enabled: 1,
  disabled: 0,
  items: [
    {
      tenantId: "tenant-1",
      saasId: "socialflow-main",
      automationKey: "socialflow.content_generation",
      displayName: "SocialFlow content generation",
      enabled: true,
      niche: "fitness",
      tone: "direct",
      frequencyPerWeek: 2,
      updatedAt: "2026-05-03T08:00:00.000Z",
    },
  ],
};

const observabilityPayload: CampoBaseSocialFlowObservability = {
  tenantId: "tenant-1",
  saasId: "socialflow-main",
  capturedAt: "2026-05-03T08:30:00.000Z",
  health: {
    status: "needs_attention",
    freshnessStatus: "fresh",
    schedulerStatus: "needs_attention",
    recommendation: "Recover 1 post(s) stuck in PUBLISHING.",
    openIncidentsCount: 1,
    latestActivityAt: "2026-05-03T08:20:00.000Z",
    latestSnapshotAt: "2026-05-03T08:25:00.000Z",
  },
  scheduler: {
    scheduledPosts: 3,
    dueScheduledPosts: 1,
    publishingPosts: 1,
    stalePublishingPosts: 1,
    nextScheduledAt: "2026-05-03T09:00:00.000Z",
    lastPublishedAt: "2026-05-03T07:30:00.000Z",
  },
  posts: {
    total: 5,
    byStatus: {
      IDEA: 0,
      DRAFT: 0,
      IN_REVIEW: 0,
      APPROVED: 0,
      REJECTED: 0,
      SCHEDULED: 3,
      PUBLISHING: 1,
      POSTED: 1,
      PUBLISHED: 0,
      FAILED: 1,
    },
    recentPublished: [
      {
        id: "posted-1",
        title: "Publicado",
        provider: "LINKEDIN",
        status: "POSTED",
        scheduledAt: null,
        postedAt: "2026-05-03T07:30:00.000Z",
        updatedAt: "2026-05-03T07:30:00.000Z",
        externalPostId: "urn:li:share:1",
        attempts: 1,
        lastErrorCode: null,
        lastErrorMessage: null,
      },
    ],
    recentFailed: [
      {
        id: "failed-1",
        title: "Falló LinkedIn",
        provider: "LINKEDIN",
        status: "FAILED",
        scheduledAt: null,
        postedAt: null,
        updatedAt: "2026-05-03T08:00:00.000Z",
        externalPostId: null,
        attempts: 3,
        lastErrorCode: "LINKEDIN_PUBLISH_FAILED",
        lastErrorMessage: "temporary timeout",
      },
    ],
    stalePublishing: [
      {
        id: "stale-1",
        title: "Post atascado",
        provider: "LINKEDIN",
        status: "PUBLISHING",
        scheduledAt: "2026-05-03T08:00:00.000Z",
        postedAt: null,
        updatedAt: "2026-05-03T08:00:00.000Z",
        externalPostId: null,
        attempts: 2,
        lastErrorCode: null,
        lastErrorMessage: null,
      },
    ],
  },
  publishing: {
    successLast30Days: 9,
    failedLast30Days: 1,
    successRateLast30Days: 0.9,
    lastFailureAt: "2026-05-03T08:00:00.000Z",
  },
  linkedin: {
    connected: true,
    totalConnections: 1,
    primaryStatus: "CONNECTED_REAL",
    connections: [
      {
        id: "account-1",
        provider: "LINKEDIN",
        handle: "drako",
        displayName: "Drako",
        status: "CONNECTED_REAL",
        isPrimary: true,
        updatedAt: "2026-05-03T08:00:00.000Z",
      },
    ],
  },
  metrics: {
    last7Days: {
      engagement: 12,
      publishedPosts: 2,
      topProvider: "LINKEDIN",
    },
    last30Days: {
      engagement: 42,
      publishedPosts: 10,
      topProvider: "LINKEDIN",
    },
  },
  recentEvents: [
    {
      id: "event-1",
      tenantId: "tenant-1",
      saasId: "socialflow-main",
      sourceType: "integration",
      sourceKey: "post:posted-1",
      activityType: "publish_succeeded",
      status: "success",
      summary: "Published successfully",
      metadata: null,
      createdAt: "2026-05-03T08:20:00.000Z",
    },
  ],
  recentIncidents: [
    {
      id: "incident-1",
      tenantId: "tenant-1",
      saasId: "socialflow-main",
      sourceType: "integration",
      sourceKey: "post:stale-1",
      incidentType: "publishing_stale",
      severity: "high",
      status: "OPEN",
      summary: "Publishing stale",
      details: null,
      openedAt: "2026-05-03T08:15:00.000Z",
      resolvedAt: null,
      updatedAt: "2026-05-03T08:15:00.000Z",
    },
  ],
};

function jsonResponse(data: unknown, status = 200) {
  return new Response(JSON.stringify(data), {
    status,
    headers: { "Content-Type": "application/json" },
  });
}

describe("/operator/socialflow health panel", () => {
  beforeEach(() => {
    fetchMock.mockReset();
  });

  it("loads operator status and renders SocialFlow observability from the public contract", async () => {
    fetchMock
      .mockResolvedValueOnce(jsonResponse({ status: statusPayload, history: [], summary: {}, observability: null }))
      .mockResolvedValueOnce(jsonResponse({
        status: statusPayload,
        history: [],
        summary: {},
        observability: observabilityPayload,
      }));

    render(React.createElement(OperatorSocialFlowPage));

    await waitFor(() => expect(fetchMock).toHaveBeenCalledTimes(2));
    expect(fetchMock.mock.calls[0][0]).toBe("/api/operator/socialflow");
    expect(fetchMock.mock.calls[1][0]).toBe("/api/operator/socialflow?tenantId=tenant-1&saasId=socialflow-main");

    expect(await screen.findByText("Salud operativa Socialcors")).toBeInTheDocument();
    expect(screen.getAllByText("needs_attention").length).toBeGreaterThan(0);
    expect(screen.getByText("CONNECTED_REAL")).toBeInTheDocument();
    expect(screen.getByText("90%")).toBeInTheDocument();
    expect(screen.getByText("Recover 1 post(s) stuck in PUBLISHING.")).toBeInTheDocument();
    expect(screen.getByText("Post atascado")).toBeInTheDocument();
    expect(screen.getByText("Falló LinkedIn")).toBeInTheDocument();
    expect(screen.getByText("Published successfully")).toBeInTheDocument();
    expect(screen.getByText("Publishing stale")).toBeInTheDocument();
  });

  it("runs safe operator actions through /api/operator/socialflow", async () => {
    fetchMock
      .mockResolvedValueOnce(jsonResponse({ status: statusPayload, history: [], summary: {}, observability: null }))
      .mockResolvedValueOnce(jsonResponse({
        status: statusPayload,
        history: [],
        summary: {},
        observability: observabilityPayload,
      }))
      .mockResolvedValueOnce(jsonResponse({
        status: statusPayload,
        result: {
          action: "recover_stale_publishing",
          tenantId: "tenant-1",
          saasId: "socialflow-main",
          scanned: 1,
          affected: 1,
          skipped: 0,
          items: [],
          message: "Recovered 1 stale PUBLISHING post(s).",
        },
        observability: {
          ...observabilityPayload,
          scheduler: {
            ...observabilityPayload.scheduler,
            stalePublishingPosts: 0,
          },
          posts: {
            ...observabilityPayload.posts,
            stalePublishing: [],
          },
        },
      }));

    render(React.createElement(OperatorSocialFlowPage));

    await waitFor(() => expect(fetchMock).toHaveBeenCalledTimes(2));
    fireEvent.click(await screen.findByRole("button", { name: "Recuperar PUBLISHING" }));

    await waitFor(() => expect(fetchMock).toHaveBeenCalledTimes(3));
    expect(fetchMock.mock.calls[2][0]).toBe("/api/operator/socialflow");
    expect(fetchMock.mock.calls[2][1]).toEqual(expect.objectContaining({
      method: "POST",
      body: JSON.stringify({
        action: "recover_stale_publishing",
        tenantId: "tenant-1",
        saasId: "socialflow-main",
      }),
    }));
    expect(await screen.findByText("Recovered 1 stale PUBLISHING post(s).")).toBeInTheDocument();
  });
});
