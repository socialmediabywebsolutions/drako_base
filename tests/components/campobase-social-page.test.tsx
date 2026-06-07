import React from "react";
import { beforeEach, describe, expect, it, vi } from "vitest";
import { fireEvent, render, screen, waitFor, within } from "@testing-library/react";
import "@testing-library/jest-dom";

import CampoBaseSocialPage from "@/app/(dashboard)/campobase/social/page";
import type { CampoBaseSocialAutomationStatusOutput } from "@/lib/operator/socialflow-service";
import type { CampoBaseSocialAutomationRun } from "@/lib/operator/social-automation-history";

const fetchMock = vi.spyOn(global, "fetch");

globalThis.React = React;

const baseStatus: CampoBaseSocialAutomationStatusOutput = {
  total: 2,
  enabled: 1,
  disabled: 1,
  items: [
    {
      tenantId: "tenant-1",
      saasId: "saas-1",
      enabled: true,
      niche: "fitness",
      tone: "direct",
      frequencyPerWeek: 2,
      updatedAt: "2024-01-01T00:00:00.000Z",
    },
    {
      tenantId: "tenant-2",
      saasId: "saas-2",
      enabled: false,
      niche: "health",
      tone: "friendly",
      frequencyPerWeek: 1,
      updatedAt: "2024-01-02T00:00:00.000Z",
    },
  ],
};

const baseHistory: CampoBaseSocialAutomationRun[] = [
  {
    id: "run-1",
    tenantId: "tenant-1",
    saasId: "saas-1",
    status: "SUCCESS",
    campaignId: "campaign-1",
    postsCount: 2,
    scheduledCount: 2,
    error: null,
    startedAt: "2024-01-01T00:00:00.000Z",
    finishedAt: "2024-01-01T00:05:00.000Z",
    createdAt: "2024-01-01T00:00:00.000Z",
  },
];

const failedHistory: CampoBaseSocialAutomationRun[] = [
  {
    id: "run-2",
    tenantId: "tenant-1",
    saasId: "saas-1",
    status: "FAILED",
    campaignId: null,
    postsCount: 0,
    scheduledCount: 0,
    error: "BOOM",
    startedAt: "2024-01-01T00:00:00.000Z",
    finishedAt: "2024-01-01T00:00:10.000Z",
    createdAt: "2024-01-01T00:00:00.000Z",
  },
];

const failedHistoryMultiple: CampoBaseSocialAutomationRun[] = [
  {
    id: "run-2",
    tenantId: "tenant-1",
    saasId: "saas-1",
    status: "FAILED",
    campaignId: null,
    postsCount: 0,
    scheduledCount: 0,
    error: "BOOM",
    startedAt: "2024-01-01T00:00:00.000Z",
    finishedAt: "2024-01-01T00:00:10.000Z",
    createdAt: "2024-01-02T00:00:00.000Z",
  },
  {
    id: "run-3",
    tenantId: "tenant-1",
    saasId: "saas-1",
    status: "FAILED",
    campaignId: null,
    postsCount: 0,
    scheduledCount: 0,
    error: "TIMEOUT",
    startedAt: "2024-01-02T00:00:00.000Z",
    finishedAt: "2024-01-02T00:00:20.000Z",
    createdAt: "2024-01-02T01:00:00.000Z",
  },
  {
    id: "run-4",
    tenantId: "tenant-2",
    saasId: "saas-2",
    status: "FAILED",
    campaignId: null,
    postsCount: 0,
    scheduledCount: 0,
    error: "NO_CONFIG",
    startedAt: "2024-01-03T00:00:00.000Z",
    finishedAt: "2024-01-03T00:00:05.000Z",
    createdAt: "2024-01-03T00:00:00.000Z",
  },
];

const baseSummary = {
  totalRuns: 1,
  successRuns: 1,
  failedRuns: 0,
  successRate: 1,
  failedRate: 0,
  totalPosts: 2,
  totalScheduled: 2,
  latestRunAt: "2024-01-01T00:00:00.000Z",
  latestFailedRunAt: null,
};

const failedSummary = {
  totalRuns: 1,
  successRuns: 0,
  failedRuns: 1,
  successRate: 0,
  failedRate: 1,
  totalPosts: 0,
  totalScheduled: 0,
  latestRunAt: "2024-01-01T00:00:00.000Z",
  latestFailedRunAt: "2024-01-01T00:00:00.000Z",
};

function jsonResponse(data: unknown, status = 200) {
  return new Response(JSON.stringify(data), {
    status,
    headers: { "Content-Type": "application/json" },
  });
}

function mockInitialLoad(status = baseStatus, history = baseHistory, summary = baseSummary) {
  fetchMock.mockResolvedValueOnce(jsonResponse({ status, history, summary }));
}

describe("Campobase social automation dashboard", () => {
  beforeEach(() => {
    fetchMock.mockReset();
  });

  it("loads initial data from the API", async () => {
    mockInitialLoad();

    render(React.createElement(CampoBaseSocialPage));

    await waitFor(() => expect(fetchMock).toHaveBeenCalled());
    expect(fetchMock).toHaveBeenCalledWith("/api/operator/socialflow", { cache: "no-store" });
  });

  it("renders metrics, SaaS table and history table", async () => {
    mockInitialLoad();

    render(React.createElement(CampoBaseSocialPage));

    await screen.findAllByText("saas-1");

    const totalCard = screen.getByText("Total", { selector: "p" }).closest("div");
    const enabledCard = screen.getByText("Enabled", { selector: "p" }).closest("div");
    const disabledCard = screen.getByText("Disabled", { selector: "p" }).closest("div");

    expect(within(totalCard as HTMLElement).getByText("2")).toBeInTheDocument();
    expect(within(enabledCard as HTMLElement).getByText("1")).toBeInTheDocument();
    expect(within(disabledCard as HTMLElement).getByText("1")).toBeInTheDocument();

    expect(screen.getAllByText("saas-1").length).toBeGreaterThan(0);
    expect(screen.getAllByText("tenant-1").length).toBeGreaterThan(0);
    expect(screen.getByText((text, element) => element?.tagName === "TD" && text === "SUCCESS")).toBeInTheDocument();
    expect(screen.getByText(/Global history/)).toBeInTheDocument();
    expect(screen.getByText("Total runs")).toBeInTheDocument();
    expect(screen.getByText("Success rate")).toBeInTheDocument();
    expect(screen.getByText("Total posts")).toBeInTheDocument();
    expect(screen.getByText("Total scheduled")).toBeInTheDocument();
  });

  it("renders duration in history table", async () => {
    mockInitialLoad();

    render(React.createElement(CampoBaseSocialPage));

    await screen.findAllByText("saas-1");
    expect(screen.getByText("300s")).toBeInTheDocument();
  });

  it("shows empty states when no SaaS or history", async () => {
    mockInitialLoad(
      { total: 0, enabled: 0, disabled: 0, items: [] },
      [],
      {
        totalRuns: 0,
        successRuns: 0,
        failedRuns: 0,
        successRate: 0,
        failedRate: 0,
        totalPosts: 0,
        totalScheduled: 0,
        latestRunAt: null,
        latestFailedRunAt: null,
      },
    );

    render(React.createElement(CampoBaseSocialPage));

    await screen.findByText("No hay SaaS registrados.");
    expect(screen.getByText("Sin historial todavía.")).toBeInTheDocument();
  });

  it("shows error when GET fails", async () => {
    fetchMock.mockResolvedValueOnce(jsonResponse({ message: "LOAD_FAIL" }, 500));

    render(React.createElement(CampoBaseSocialPage));

    await screen.findByText("LOAD_FAIL");
    expect(screen.getByText("LOAD_FAIL")).toBeInTheDocument();
  });

  it("posts run_all and refreshes status", async () => {
    mockInitialLoad();
    fetchMock.mockResolvedValueOnce(jsonResponse({
      action: "run_all",
      result: { total: 1, success: 1, failed: 0, results: [] },
      status: baseStatus,
    }));
    fetchMock.mockResolvedValueOnce(jsonResponse({ status: baseStatus, history: baseHistory, summary: baseSummary }));

    render(React.createElement(CampoBaseSocialPage));

    await screen.findAllByText("saas-1");
    fireEvent.click(screen.getByRole("button", { name: "Run ALL" }));

    await waitFor(() => expect(fetchMock).toHaveBeenCalledTimes(3));

    const postCall = fetchMock.mock.calls[1];
    expect(postCall[0]).toBe("/api/operator/socialflow");
    expect(postCall[1]?.method).toBe("POST");
    expect(JSON.parse(postCall[1]?.body as string)).toEqual({ action: "run_all" });

    const refreshCall = fetchMock.mock.calls[2];
    expect(refreshCall[0]).toBe("/api/operator/socialflow");
    expect(refreshCall[1]?.method).toBeUndefined();
  });

  it("posts run_one and refreshes status", async () => {
    mockInitialLoad();
    fetchMock.mockResolvedValueOnce(jsonResponse({
      action: "run_one",
      result: { campaignId: "campaign-1", postsCount: 1, scheduledCount: 1 },
      status: baseStatus,
    }));
    fetchMock.mockResolvedValueOnce(jsonResponse({ status: baseStatus, history: baseHistory, summary: baseSummary }));

    render(React.createElement(CampoBaseSocialPage));

    await screen.findAllByText("saas-1");
    fireEvent.click(screen.getAllByRole("button", { name: "Run" })[0]);

    await waitFor(() => expect(fetchMock).toHaveBeenCalledTimes(3));

    const postCall = fetchMock.mock.calls[1];
    expect(JSON.parse(postCall[1]?.body as string)).toEqual({
      action: "run_one",
      tenantId: "tenant-1",
      saasId: "saas-1",
    });

    const refreshCall = fetchMock.mock.calls[2];
    expect(refreshCall[0]).toBe("/api/operator/socialflow?tenantId=tenant-1&saasId=saas-1");
    expect(screen.getByText("Filtered by saas-1")).toBeInTheDocument();
  });

  it("applies status filter", async () => {
    mockInitialLoad();
    fetchMock.mockResolvedValueOnce(jsonResponse({ status: baseStatus, history: failedHistory, summary: failedSummary }));

    render(React.createElement(CampoBaseSocialPage));

    await screen.findAllByText("saas-1");
    fireEvent.change(screen.getByLabelText("Status"), { target: { value: "FAILED" } });
    fireEvent.click(screen.getByRole("button", { name: "Apply filters" }));

    await waitFor(() => expect(fetchMock).toHaveBeenCalledTimes(2));

    const filterCall = fetchMock.mock.calls[1];
    expect(filterCall[0]).toContain("status=FAILED");
    expect(screen.getByText(/Filtered/)).toBeInTheDocument();
  });

  it("resets filters", async () => {
    mockInitialLoad();
    fetchMock.mockResolvedValueOnce(jsonResponse({ status: baseStatus, history: failedHistory, summary: failedSummary }));
    fetchMock.mockResolvedValueOnce(jsonResponse({ status: baseStatus, history: baseHistory, summary: baseSummary }));

    render(React.createElement(CampoBaseSocialPage));

    await screen.findAllByText("saas-1");
    fireEvent.change(screen.getByLabelText("Status"), { target: { value: "FAILED" } });
    fireEvent.click(screen.getByRole("button", { name: "Apply filters" }));
    await waitFor(() => expect(fetchMock).toHaveBeenCalledTimes(2));

    fireEvent.click(screen.getByRole("button", { name: "Reset filters" }));
    await waitFor(() => expect(fetchMock).toHaveBeenCalledTimes(3));

    const resetCall = fetchMock.mock.calls[2];
    expect(resetCall[0]).toBe("/api/operator/socialflow");
    expect(screen.getByText(/Global history/)).toBeInTheDocument();
  });

  it("posts enable", async () => {
    mockInitialLoad();
    fetchMock.mockResolvedValueOnce(jsonResponse({
      action: "enable",
      result: { tenantId: "tenant-1", saasId: "saas-1", enabled: true },
      status: baseStatus,
    }));

    render(React.createElement(CampoBaseSocialPage));

    await screen.findAllByText("saas-1");
    fireEvent.click(screen.getAllByRole("button", { name: "Enable" })[1]);

    await waitFor(() => expect(fetchMock).toHaveBeenCalledTimes(2));

    const postCall = fetchMock.mock.calls[1];
    expect(JSON.parse(postCall[1]?.body as string)).toEqual({
      action: "enable",
      tenantId: "tenant-2",
      saasId: "saas-2",
    });
  });

  it("posts disable", async () => {
    mockInitialLoad();
    fetchMock.mockResolvedValueOnce(jsonResponse({
      action: "disable",
      result: { tenantId: "tenant-1", saasId: "saas-1", enabled: false },
      status: baseStatus,
    }));

    render(React.createElement(CampoBaseSocialPage));

    await screen.findAllByText("saas-1");
    fireEvent.click(screen.getAllByRole("button", { name: "Disable" })[0]);

    await waitFor(() => expect(fetchMock).toHaveBeenCalledTimes(2));

    const postCall = fetchMock.mock.calls[1];
    expect(JSON.parse(postCall[1]?.body as string)).toEqual({
      action: "disable",
      tenantId: "tenant-1",
      saasId: "saas-1",
    });
  });

  it("filters history when view history is clicked", async () => {
    mockInitialLoad();
    fetchMock.mockResolvedValueOnce(jsonResponse({ status: baseStatus, history: baseHistory, summary: baseSummary }));

    render(React.createElement(CampoBaseSocialPage));

    await screen.findAllByText("saas-1");
    fireEvent.click(screen.getAllByRole("button", { name: "View history" })[0]);

    await waitFor(() => expect(fetchMock).toHaveBeenCalledTimes(2));

    const filterCall = fetchMock.mock.calls[1];
    expect(filterCall[0]).toBe("/api/operator/socialflow?tenantId=tenant-1&saasId=saas-1");
    expect(screen.getByText(/Filtered by saas-1/)).toBeInTheDocument();
  });

  it("clears filter and fetches global history", async () => {
    mockInitialLoad();
    fetchMock.mockResolvedValueOnce(jsonResponse({ status: baseStatus, history: baseHistory, summary: baseSummary }));
    fetchMock.mockResolvedValueOnce(jsonResponse({ status: baseStatus, history: baseHistory, summary: baseSummary }));

    render(React.createElement(CampoBaseSocialPage));

    await screen.findAllByText("saas-1");
    fireEvent.click(screen.getAllByRole("button", { name: "View history" })[0]);
    await waitFor(() => expect(fetchMock).toHaveBeenCalledTimes(2));

    fireEvent.click(screen.getByRole("button", { name: "Clear filter" }));
    await waitFor(() => expect(fetchMock).toHaveBeenCalledTimes(3));

    const clearCall = fetchMock.mock.calls[2];
    expect(clearCall[0]).toBe("/api/operator/socialflow");
    expect(screen.getByText(/Global history/)).toBeInTheDocument();
  });

  it("retries failed runs", async () => {
    mockInitialLoad(baseStatus, failedHistory, failedSummary);
    fetchMock.mockResolvedValueOnce(jsonResponse({
      action: "run_one",
      result: { campaignId: "campaign-2", postsCount: 1, scheduledCount: 1 },
      status: baseStatus,
    }));
    fetchMock.mockResolvedValueOnce(jsonResponse({ status: baseStatus, history: failedHistory, summary: failedSummary }));

    render(React.createElement(CampoBaseSocialPage));

    await screen.findByText("Retry run");
    fireEvent.click(screen.getByRole("button", { name: "Retry run" }));

    await waitFor(() => expect(fetchMock).toHaveBeenCalledTimes(3));

    const postCall = fetchMock.mock.calls[1];
    expect(JSON.parse(postCall[1]?.body as string)).toEqual({
      action: "run_one",
      tenantId: "tenant-1",
      saasId: "saas-1",
    });
  });

  it("keeps filters active after retry", async () => {
    mockInitialLoad(baseStatus, failedHistory, failedSummary);
    fetchMock.mockResolvedValueOnce(jsonResponse({ status: baseStatus, history: failedHistory, summary: failedSummary }));
    fetchMock.mockResolvedValueOnce(jsonResponse({
      action: "run_one",
      result: { campaignId: "campaign-2", postsCount: 1, scheduledCount: 1 },
      status: baseStatus,
    }));
    fetchMock.mockResolvedValueOnce(jsonResponse({ status: baseStatus, history: failedHistory, summary: failedSummary }));

    render(React.createElement(CampoBaseSocialPage));

    await screen.findAllByText("saas-1");
    fireEvent.change(screen.getByLabelText("Status"), { target: { value: "FAILED" } });
    fireEvent.click(screen.getByRole("button", { name: "Apply filters" }));
    await waitFor(() => expect(fetchMock).toHaveBeenCalledTimes(2));

    fireEvent.click(screen.getByRole("button", { name: "Retry run" }));
    await waitFor(() => expect(fetchMock).toHaveBeenCalledTimes(4));

    const refreshCall = fetchMock.mock.calls[3];
    expect(refreshCall[0]).toContain("status=FAILED");
  });

  it("shows filtered empty state", async () => {
    mockInitialLoad();
    fetchMock.mockResolvedValueOnce(jsonResponse({ status: baseStatus, history: [], summary: baseSummary }));

    render(React.createElement(CampoBaseSocialPage));

    await screen.findAllByText("saas-1");
    fireEvent.change(screen.getByLabelText("Status"), { target: { value: "FAILED" } });
    fireEvent.click(screen.getByRole("button", { name: "Apply filters" }));

    await screen.findByText("No executions match current filters.");
  });

  it("retries failed visible without duplicates", async () => {
    mockInitialLoad(baseStatus, failedHistoryMultiple, {
      totalRuns: 3,
      successRuns: 0,
      failedRuns: 3,
      successRate: 0,
      failedRate: 1,
      totalPosts: 0,
      totalScheduled: 0,
      latestRunAt: "2024-01-03T00:00:00.000Z",
      latestFailedRunAt: "2024-01-03T00:00:00.000Z",
    });
    fetchMock
      .mockResolvedValueOnce(jsonResponse({
        action: "run_one",
        result: { campaignId: "campaign-2", postsCount: 1, scheduledCount: 1 },
        status: baseStatus,
      }))
      .mockResolvedValueOnce(jsonResponse({
        action: "run_one",
        result: { campaignId: "campaign-3", postsCount: 1, scheduledCount: 1 },
        status: baseStatus,
      }))
      .mockResolvedValueOnce(jsonResponse({
        status: baseStatus,
        history: failedHistoryMultiple,
        summary: {
          totalRuns: 3,
          successRuns: 0,
          failedRuns: 3,
          successRate: 0,
          failedRate: 1,
          totalPosts: 0,
          totalScheduled: 0,
          latestRunAt: "2024-01-03T00:00:00.000Z",
          latestFailedRunAt: "2024-01-03T00:00:00.000Z",
        },
      }));

    render(React.createElement(CampoBaseSocialPage));

    await screen.findByRole("button", { name: "Retry failed visible" });
    fireEvent.click(screen.getByRole("button", { name: "Retry failed visible" }));

    await waitFor(() => expect(fetchMock).toHaveBeenCalledTimes(4));

    const postCallOne = fetchMock.mock.calls[1];
    const postCallTwo = fetchMock.mock.calls[2];
    const payloads = [postCallOne, postCallTwo].map((call) => JSON.parse(call[1]?.body as string));

    expect(payloads).toContainEqual({ action: "run_one", tenantId: "tenant-1", saasId: "saas-1" });
    expect(payloads).toContainEqual({ action: "run_one", tenantId: "tenant-2", saasId: "saas-2" });
  });

  it("retry failed visible keeps filters after refresh", async () => {
    mockInitialLoad(baseStatus, failedHistoryMultiple, {
      totalRuns: 3,
      successRuns: 0,
      failedRuns: 3,
      successRate: 0,
      failedRate: 1,
      totalPosts: 0,
      totalScheduled: 0,
      latestRunAt: "2024-01-03T00:00:00.000Z",
      latestFailedRunAt: "2024-01-03T00:00:00.000Z",
    });
    fetchMock.mockResolvedValueOnce(jsonResponse({
      status: baseStatus,
      history: failedHistoryMultiple,
      summary: {
        totalRuns: 3,
        successRuns: 0,
        failedRuns: 3,
        successRate: 0,
        failedRate: 1,
        totalPosts: 0,
        totalScheduled: 0,
        latestRunAt: "2024-01-03T00:00:00.000Z",
        latestFailedRunAt: "2024-01-03T00:00:00.000Z",
      },
    }));
    fetchMock
      .mockResolvedValueOnce(jsonResponse({
        action: "run_one",
        result: { campaignId: "campaign-2", postsCount: 1, scheduledCount: 1 },
        status: baseStatus,
      }))
      .mockResolvedValueOnce(jsonResponse({
        action: "run_one",
        result: { campaignId: "campaign-3", postsCount: 1, scheduledCount: 1 },
        status: baseStatus,
      }))
      .mockResolvedValueOnce(jsonResponse({
        status: baseStatus,
        history: failedHistoryMultiple,
        summary: {
          totalRuns: 3,
          successRuns: 0,
          failedRuns: 3,
          successRate: 0,
          failedRate: 1,
          totalPosts: 0,
          totalScheduled: 0,
          latestRunAt: "2024-01-03T00:00:00.000Z",
          latestFailedRunAt: "2024-01-03T00:00:00.000Z",
        },
      }));

    render(React.createElement(CampoBaseSocialPage));

    await screen.findAllByText("saas-1");
    fireEvent.change(screen.getByLabelText("Status"), { target: { value: "FAILED" } });
    fireEvent.click(screen.getByRole("button", { name: "Apply filters" }));
    await waitFor(() => expect(fetchMock).toHaveBeenCalledTimes(2));

    fireEvent.click(screen.getByRole("button", { name: "Retry failed visible" }));
    await waitFor(() => expect(fetchMock).toHaveBeenCalledTimes(5));

    const refreshCall = fetchMock.mock.calls[4];
    expect(refreshCall[0]).toContain("status=FAILED");
  });
});
