"use client";

import { useEffect, useState } from "react";
import Badge from "@/components/ui/badge";
import Button from "@/components/ui/button";
import Card from "@/components/ui/card";
import EmptyState from "@/components/ui/empty-state";
import { Table, TableWrap, TBody, TD, TH, THead } from "@/components/ui/table";
import type {
  CampoBaseSocialAutomationBatchOutput,
  CampoBaseSocialAutomationOutput,
  CampoBaseSocialAutomationStatusOutput,
  CampoBaseSocialAutomationToggleOutput,
} from "@/lib/campobase/socialflow-service";

type ControlResponse = {
  status?: CampoBaseSocialAutomationStatusOutput;
  result?: CampoBaseSocialAutomationBatchOutput | CampoBaseSocialAutomationOutput | CampoBaseSocialAutomationToggleOutput;
  message?: string;
  code?: string;
};

const endpoint = "/api/campobase/socialflow";

function formatDate(value: string): string {
  const parsed = new Date(value);
  if (Number.isNaN(parsed.getTime())) {
    return value;
  }

  return parsed.toLocaleString();
}

export default function CampoBaseSocialAutomationControl() {
  const [status, setStatus] = useState<CampoBaseSocialAutomationStatusOutput | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [message, setMessage] = useState<string | null>(null);
  const [busyKey, setBusyKey] = useState<string | null>(null);

  async function loadStatus() {
    setLoading(true);
    setError(null);

    try {
      const response = await fetch(endpoint, { cache: "no-store" });
      const data = (await response.json().catch(() => null)) as ControlResponse | null;

      if (!response.ok || !data?.status) {
        throw new Error(data?.message ?? "No se pudo cargar el control de SocialFlow.");
      }

      setStatus(data.status);
    } catch (loadError) {
      setStatus(null);
      setError(loadError instanceof Error ? loadError.message : "No se pudo cargar el control de SocialFlow.");
    } finally {
      setLoading(false);
    }
  }

  useEffect(() => {
    void loadStatus();
  }, []);

  async function runAction(
    action: "run_all" | "run_one" | "enable" | "disable",
    payload?: { tenantId: string; saasId: string },
  ) {
    const key = payload ? `${action}:${payload.tenantId}:${payload.saasId}` : action;
    setBusyKey(key);
    setError(null);
    setMessage(null);

    try {
      const response = await fetch(endpoint, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ action, ...payload }),
      });
      const data = (await response.json().catch(() => null)) as ControlResponse | null;

      if (!response.ok || !data?.status) {
        throw new Error(data?.message ?? "No se pudo completar la acción.");
      }

      setStatus(data.status);

      if (action === "run_all" && data.result && "success" in data.result) {
        setMessage(`Run All ejecutado: ${data.result.success}/${data.result.total} ok.`);
        return;
      }

      if (action === "run_one" && payload) {
        setMessage(`Automatización lanzada para ${payload.saasId}.`);
        return;
      }

      if ((action === "enable" || action === "disable") && payload) {
        setMessage(`${payload.saasId} ${action === "enable" ? "enabled" : "disabled"}.`);
      }
    } catch (actionError) {
      setError(actionError instanceof Error ? actionError.message : "No se pudo completar la acción.");
    } finally {
      setBusyKey(null);
    }
  }

  return (
    <div className="space-y-6 p-6">
      <Card
        tone="glass"
        title="Campo Base Social Automation"
        subtitle="Control de automatización social por SaaS"
        right={status ? `${status.total} saas registrados` : "Control interno"}
        actions={(
          <Button
            variant="brand"
            loading={busyKey === "run_all"}
            onClick={() => void runAction("run_all")}
          >
            Run All
          </Button>
        )}
      >
        <div className="grid gap-4 md:grid-cols-3">
          <div className="rounded-2xl border border-slate-200 bg-white/80 p-4">
            <p className="text-xs uppercase tracking-[0.2em] text-slate-500">Total</p>
            <p className="mt-2 text-3xl font-semibold text-slate-900">{status?.total ?? 0}</p>
          </div>
          <div className="rounded-2xl border border-emerald-200 bg-emerald-50/80 p-4">
            <p className="text-xs uppercase tracking-[0.2em] text-emerald-700">Enabled</p>
            <p className="mt-2 text-3xl font-semibold text-emerald-900">{status?.enabled ?? 0}</p>
          </div>
          <div className="rounded-2xl border border-rose-200 bg-rose-50/80 p-4">
            <p className="text-xs uppercase tracking-[0.2em] text-rose-700">Disabled</p>
            <p className="mt-2 text-3xl font-semibold text-rose-900">{status?.disabled ?? 0}</p>
          </div>
        </div>
      </Card>

      {message ? (
        <div className="rounded-2xl border border-emerald-200 bg-emerald-50 px-4 py-3 text-sm text-emerald-800">
          {message}
        </div>
      ) : null}

      {error ? (
        <div className="rounded-2xl border border-rose-200 bg-rose-50 px-4 py-3 text-sm text-rose-700">
          {error}
        </div>
      ) : null}

      <Card tone="default" title="SaaS registrados" subtitle="Estado actual y configuración base">
        {loading ? (
          <p className="text-sm text-slate-500">Cargando control...</p>
        ) : !status || status.items.length === 0 ? (
          <EmptyState
            title="Sin SaaS registrados"
            subtitle="El registro de automatización social todavía no tiene elementos disponibles."
          />
        ) : (
          <TableWrap>
            <Table>
              <THead>
                <tr>
                  <TH className="px-4 py-3 text-left">Tenant</TH>
                  <TH className="px-4 py-3 text-left">SaaS</TH>
                  <TH className="px-4 py-3 text-left">Estado</TH>
                  <TH className="px-4 py-3 text-left">Niche</TH>
                  <TH className="px-4 py-3 text-left">Tone</TH>
                  <TH className="px-4 py-3 text-left">Freq/Week</TH>
                  <TH className="px-4 py-3 text-left">Updated</TH>
                  <TH className="px-4 py-3 text-left">Acciones</TH>
                </tr>
              </THead>
              <TBody>
                {status.items.map((item) => (
                  <tr key={`${item.tenantId}:${item.saasId}`} className="border-b border-slate-100 last:border-b-0">
                    <TD className="px-4 py-3 text-sm text-slate-700">{item.tenantId}</TD>
                    <TD className="px-4 py-3 text-sm font-semibold text-slate-900">{item.saasId}</TD>
                    <TD className="px-4 py-3">
                      <Badge variant={item.enabled ? "ok" : "err"}>
                        {item.enabled ? "enabled" : "disabled"}
                      </Badge>
                    </TD>
                    <TD className="px-4 py-3 text-sm text-slate-700">{item.niche}</TD>
                    <TD className="px-4 py-3 text-sm text-slate-700">{item.tone}</TD>
                    <TD className="px-4 py-3 text-sm text-slate-700">{item.frequencyPerWeek}</TD>
                    <TD className="px-4 py-3 text-sm text-slate-700">{formatDate(item.updatedAt)}</TD>
                    <TD className="px-4 py-3">
                      <div className="flex flex-wrap gap-2">
                        <Button
                          size="sm"
                          variant="outline"
                          loading={busyKey === `enable:${item.tenantId}:${item.saasId}`}
                          disabled={item.enabled}
                          onClick={() => void runAction("enable", { tenantId: item.tenantId, saasId: item.saasId })}
                        >
                          Enable
                        </Button>
                        <Button
                          size="sm"
                          variant="outline"
                          loading={busyKey === `disable:${item.tenantId}:${item.saasId}`}
                          disabled={!item.enabled}
                          onClick={() => void runAction("disable", { tenantId: item.tenantId, saasId: item.saasId })}
                        >
                          Disable
                        </Button>
                        <Button
                          size="sm"
                          variant="primary"
                          loading={busyKey === `run_one:${item.tenantId}:${item.saasId}`}
                          disabled={!item.enabled}
                          onClick={() => void runAction("run_one", { tenantId: item.tenantId, saasId: item.saasId })}
                        >
                          Run
                        </Button>
                      </div>
                    </TD>
                  </tr>
                ))}
              </TBody>
            </Table>
          </TableWrap>
        )}
      </Card>
    </div>
  );
}
