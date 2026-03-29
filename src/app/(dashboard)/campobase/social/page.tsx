"use client";

import { useEffect, useState } from "react";

export const dynamic = "force-dynamic";

interface SocialData {
  status: {
    total: number;
    enabled: number;
    disabled: number;
    items: Array<{ saasId: string; tenantId: string; enabled: boolean; niche: string; tone: string; frequencyPerWeek: number; updatedAt: string }>;
  };
  history: Array<{ id: string; tenantId: string; saasId: string; status: string; campaignId: string | null; postsCount: number; scheduledCount: number; error: string | null; startedAt: string; finishedAt: string; createdAt: string }>;
  summary: { totalRuns: number; successRuns: number; failedRuns: number; successRate: number; failedRate: number; totalPosts: number; totalScheduled: number; latestRunAt: string | null; latestFailedRunAt: string | null };
}

export default function CampoBaseSocialPage() {
  const [data, setData] = useState<SocialData | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [filterStatus, setFilterStatus] = useState<string>("");
  const [filteredData, setFilteredData] = useState<SocialData | null>(null);
  const [selectedSaas, setSelectedSaas] = useState<string | null>(null);

  useEffect(() => {
    fetch("/api/operator/socialflow", { cache: "no-store" })
      .then((res) => {
        if (!res.ok) throw new Error("HTTP error");
        return res.json();
      })
      .then((json) => {
        const typedData = json as SocialData;
        setData(typedData);
        setFilteredData(typedData);
      })
      .catch(() => setError("LOAD_FAIL"));
  }, []);

  const handleRunAll = async () => {
    if (!data) return;
    try {
      await fetch("/api/operator/socialflow", {
        method: "POST",
        body: JSON.stringify({ action: "run_all" }),
      });
      const response = await fetch("/api/operator/socialflow", { cache: "no-store" });
      const result = (await response.json()) as SocialData;
      setData(result);
      setFilteredData(result);
    } catch {
      setError("LOAD_FAIL");
    }
  };

  const handleRunOne = async (tenantId: string, saasId: string) => {
    if (!data) return;
    try {
      setSelectedSaas(saasId);
      const response = await fetch("/api/operator/socialflow", {
        method: "POST",
        body: JSON.stringify({ action: "run_one", tenantId, saasId }),
      });
      const result = (await response.json()) as SocialData;
      const url = `/api/operator/socialflow?tenantId=${tenantId}&saasId=${saasId}`;
      const refreshResponse = await fetch(url, { cache: "no-store" });
      const refreshed = (await refreshResponse.json()) as SocialData;
      setData(refreshed);
      setFilteredData(refreshed);
    } catch {
      setError("LOAD_FAIL");
    }
  };

  const handleEnable = async (tenantId: string, saasId: string) => {
    if (!data) return;
    try {
      const response = await fetch("/api/operator/socialflow", {
        method: "POST",
        body: JSON.stringify({ action: "enable", tenantId, saasId }),
      });
      const result = (await response.json()) as SocialData;
      setData(result);
      setFilteredData(result);
    } catch {
      setError("LOAD_FAIL");
    }
  };

  const handleDisable = async (tenantId: string, saasId: string) => {
    if (!data) return;
    try {
      const response = await fetch("/api/operator/socialflow", {
        method: "POST",
        body: JSON.stringify({ action: "disable", tenantId, saasId }),
      });
      const result = (await response.json()) as SocialData;
      setData(result);
      setFilteredData(result);
    } catch {
      setError("LOAD_FAIL");
    }
  };

  const handleViewHistory = async (tenantId: string, saasId: string) => {
    if (!data) return;
    try {
      setSelectedSaas(saasId);
      const url = `/api/operator/socialflow?tenantId=${tenantId}&saasId=${saasId}`;
      const response = await fetch(url, { cache: "no-store" });
      const result = (await response.json()) as SocialData;
      setFilteredData(result);
    } catch {
      setError("LOAD_FAIL");
    }
  };

  const handleApplyFilters = async () => {
    if (!data) return;
    try {
      const params = new URLSearchParams();
      if (filterStatus) params.append("status", filterStatus);
      const url = `/api/operator/socialflow?${params.toString()}`;
      const response = await fetch(url, { cache: "no-store" });
      const result = await response.json();
      setFilteredData(result);
      setSelectedSaas("filtered");
    } catch {
      setError("LOAD_FAIL");
    }
  };

  const handleResetFilters = async () => {
    if (!data) return;
    try {
      const response = await fetch("/api/operator/socialflow", { cache: "no-store" });
      const result = await response.json();
      setFilteredData(result);
      setFilterStatus("");
      setSelectedSaas(null);
    } catch {
      setError("LOAD_FAIL");
    }
  };

  const handleClearFilter = async () => {
    if (!data) return;
    try {
      const response = await fetch("/api/operator/socialflow", { cache: "no-store" });
      const result = await response.json();
      setFilteredData(result);
      setSelectedSaas(null);
    } catch {
      setError("LOAD_FAIL");
    }
  };

  const handleRetryRun = async (tenantId: string, saasId: string) => {
    if (!data) return;
    try {
      const response = await fetch("/api/operator/socialflow", {
        method: "POST",
        body: JSON.stringify({ action: "run_one", tenantId, saasId }),
      });
      const result = await response.json();
      const url = filterStatus ? `/api/operator/socialflow?status=${filterStatus}` : "/api/operator/socialflow";
      const refreshResponse = await fetch(url, { cache: "no-store" });
      const refreshed = await refreshResponse.json();
      setData(refreshed);
      setFilteredData(refreshed);
    } catch {
      setError("LOAD_FAIL");
    }
  };

  const handleRetryFailedVisible = async () => {
    if (!filteredData) return;
    try {
      const failedRuns = filteredData.history.filter((h) => h.status === "FAILED");
      const uniqueSaas = new Map<string, { tenantId: string; saasId: string }>();
      failedRuns.forEach((run) => {
        uniqueSaas.set(`${run.tenantId}:${run.saasId}`, { tenantId: run.tenantId, saasId: run.saasId });
      });

      for (const { tenantId, saasId } of uniqueSaas.values()) {
        await fetch("/api/operator/socialflow", {
          method: "POST",
          body: JSON.stringify({ action: "run_one", tenantId, saasId }),
        });
      }

      const url = filterStatus ? `/api/operator/socialflow?status=${filterStatus}` : "/api/operator/socialflow";
      const refreshResponse = await fetch(url, { cache: "no-store" });
      const refreshed = await refreshResponse.json();
      setData(refreshed);
      setFilteredData(refreshed);
    } catch {
      setError("LOAD_FAIL");
    }
  };

  if (error) {
    return <div>{error}</div>;
  }

  if (!data || !filteredData) {
    return <div>Loading...</div>;
  }

  const isFiltered = selectedSaas !== null || filteredData !== data;
  const displayData = filteredData || data;

  return (
    <div>
      <div>
        <p>Total</p>
        <div>{data?.status?.total ?? 0}</div>
      </div>
      <div>
        <p>Enabled</p>
        <div>{data?.status?.enabled ?? 0}</div>
      </div>
      <div>
        <p>Disabled</p>
        <div>{data?.status?.disabled ?? 0}</div>
      </div>

      {(data?.status?.items?.length ?? 0) === 0 ? (
        <div>No hay SaaS registrados.</div>
      ) : (
        <table>
          <tbody>
            {data?.status?.items?.map((item) => (
              <tr key={`${item.tenantId}-${item.saasId}`}>
                <td>{item.saasId}</td>
                <td>{item.tenantId}</td>
                <td>{item.enabled ? "enabled" : "disabled"}</td>
                <td>
                  <button onClick={() => handleRunOne(item.tenantId, item.saasId)}>Run</button>
                  <button onClick={() => handleEnable(item.tenantId, item.saasId)} disabled={item.enabled}>
                    Enable
                  </button>
                  <button onClick={() => handleDisable(item.tenantId, item.saasId)} disabled={!item.enabled}>
                    Disable
                  </button>
                  <button onClick={() => handleViewHistory(item.tenantId, item.saasId)}>View history</button>
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      )}

      <div>
        <label>
          Status
          <select value={filterStatus} onChange={(e) => setFilterStatus(e.target.value)}>
            <option value="">All</option>
            <option value="SUCCESS">SUCCESS</option>
            <option value="FAILED">FAILED</option>
          </select>
        </label>
        <button onClick={handleApplyFilters}>Apply filters</button>
        <button onClick={handleResetFilters}>Reset filters</button>
      </div>

      <div>
        {selectedSaas && selectedSaas !== "filtered"
          ? `Filtered by ${selectedSaas}`
          : selectedSaas === "filtered"
          ? "Filtered"
          : "Global history"}
      </div>
      <div>
        <p>Total runs</p>
        <div>{displayData?.summary?.totalRuns ?? 0}</div>
      </div>
      <div>
        <p>Success rate</p>
        <div>{displayData?.summary?.successRate ?? 0}</div>
      </div>
      <div>
        <p>Total posts</p>
        <div>{displayData?.summary?.totalPosts ?? 0}</div>
      </div>
      <div>
        <p>Total scheduled</p>
        <div>{displayData?.summary?.totalScheduled ?? 0}</div>
      </div>

      {(displayData?.history?.length ?? 0) === 0 ? (
        <div>
          {filterStatus ? "No executions match current filters." : "Sin historial todavía."}
        </div>
      ) : (
        <table>
          <tbody>
            {displayData?.history?.map((run) => (
              <tr key={run.id}>
                <td>{run.saasId}</td>
                <td>{run.tenantId}</td>
                <td>{run.status}</td>
                <td>
                  {run.status === "FAILED" && (
                    <button onClick={() => handleRetryRun(run.tenantId, run.saasId)}>Retry run</button>
                  )}
                </td>
                <td>
                  {Math.round((new Date(run.finishedAt).getTime() - new Date(run.startedAt).getTime()) / 1000)}s
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      )}

      <button onClick={handleRunAll}>Run ALL</button>
      {(displayData?.history?.some((h) => h.status === "FAILED")) && (
        <button onClick={handleRetryFailedVisible}>Retry failed visible</button>
      )}
      {isFiltered && <button onClick={handleClearFilter}>Clear filter</button>}
    </div>
  );
}
