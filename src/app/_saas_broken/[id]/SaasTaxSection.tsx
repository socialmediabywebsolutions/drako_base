"use client";

import { useCallback, useEffect, useMemo, useState } from "react";
import Card from "@/components/ui/card";
import Badge from "@/components/ui/badge";
import Button from "@/components/ui/button";
import Select from "@/components/ui/select";
import { Field, TextInput } from "@/components/ui/input";
import type { SaasTaxPeriod, SaasTaxProfile, SaasTaxSummaryForSaas } from "@/lib/tax/types";

type Props = {
  saasId: string | null;
};

const STATUS_LABELS: Record<SaasTaxSummaryForSaas["status"], string> = {
  OK: "OK",
  TIGHT: "Ajustado",
  RISK: "Riesgo",
};

const STATUS_TONES: Record<SaasTaxSummaryForSaas["status"], "ok" | "warn" | "err"> = {
  OK: "ok",
  TIGHT: "warn",
  RISK: "err",
};

export default function SaasTaxSection({ saasId }: Props) {
  const [profile, setProfile] = useState<SaasTaxProfile | null>(null);
  const [summary, setSummary] = useState<SaasTaxSummaryForSaas | null>(null);
  const [periods, setPeriods] = useState<SaasTaxPeriod[]>([]);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [recalcLoading, setRecalcLoading] = useState(false);

  const currencyFormatter = useMemo(
    () =>
      new Intl.NumberFormat("es-ES", {
        style: "currency",
        currency: "EUR",
        maximumFractionDigits: 0,
      }),
    [],
  );

  const loadTaxData = useCallback(async () => {
    if (!saasId) return;
    setLoading(true);
    try {
      const [profileRes, periodsRes] = await Promise.all([
        fetch(`/api/saas/${encodeURIComponent(saasId)}/tax/profile`, { cache: "no-store" }),
        fetch(`/api/saas/${encodeURIComponent(saasId)}/tax/periods`, { cache: "no-store" }),
      ]);
      const profileJson = (await profileRes.json().catch(() => null)) as { profile?: SaasTaxProfile } | null;
      const periodsJson = (await periodsRes.json().catch(() => null)) as { items?: SaasTaxPeriod[] } | null;
      setProfile(profileJson?.profile ?? null);
      setPeriods(periodsJson?.items ?? []);
      if (periodsJson?.items?.length) {
        const latest = periodsJson.items[0];
        setSummary({
          currentQuarterKey: latest.periodKey,
          currentQuarterVatDue: latest.vatDue,
          currentQuarterRevenue: latest.estimatedRevenue,
          currentQuarterExpenses: latest.estimatedExpenses,
          nextDeadline: null,
          status: latest.vatDue > 1500 ? "RISK" : latest.vatDue > 0 ? "TIGHT" : "OK",
          notes: latest.notes ?? null,
        });
      } else {
        setSummary(null);
      }
    } catch {
      setProfile(null);
      setPeriods([]);
      setSummary(null);
    } finally {
      setLoading(false);
    }
  }, [saasId]);

  useEffect(() => {
    void loadTaxData();
  }, [loadTaxData]);

  const handleRecalculate = async () => {
    if (!saasId) return;
    setRecalcLoading(true);
    try {
      await fetch(`/api/saas/${encodeURIComponent(saasId)}/tax/periods`, { method: "POST" });
      await loadTaxData();
    } finally {
      setRecalcLoading(false);
    }
  };

  const handleSaveProfile = async () => {
    if (!saasId || !profile) return;
    setSaving(true);
    try {
      const res = await fetch(`/api/saas/${encodeURIComponent(saasId)}/tax/profile`, {
        method: "PATCH",
        headers: { "content-type": "application/json" },
        body: JSON.stringify({
          country: profile.country,
          region: profile.region,
          regime: profile.regime,
          defaultVatRate: profile.defaultVatRate,
          reducedVatRate: profile.reducedVatRate,
          superReducedVatRate: profile.superReducedVatRate,
          usesWithholding: profile.usesWithholding,
          withholdingRate: profile.withholdingRate,
          incomeTaxMode: profile.incomeTaxMode,
        }),
      });
      const json = (await res.json().catch(() => null)) as { profile?: SaasTaxProfile } | null;
      setProfile(json?.profile ?? profile);
    } finally {
      setSaving(false);
    }
  };

  return (
    <section id="tax-section" className="space-y-4">
      <Card title="Contabilidad & Impuestos" subtitle="Estimaciones trimestrales (demo) y configuración fiscal">
        <div className="grid grid-cols-1 md:grid-cols-3 gap-3">
          <div className="rounded-xl border border-white/10 p-4">
            <p className="text-xs uppercase tracking-wide text-muted-foreground">IVA trimestre</p>
            <p className="text-2xl font-semibold">
              {summary ? currencyFormatter.format(summary.currentQuarterVatDue) : "—"}
            </p>
          </div>
          <div className="rounded-xl border border-white/10 p-4">
            <p className="text-xs uppercase tracking-wide text-muted-foreground">Ingresos vs gastos</p>
            <p className="text-lg font-semibold">
              {summary
                ? `${currencyFormatter.format(summary.currentQuarterRevenue)} / ${currencyFormatter.format(summary.currentQuarterExpenses)}`
                : "—"}
            </p>
          </div>
          <div className="rounded-xl border border-white/10 p-4">
            <p className="text-xs uppercase tracking-wide text-muted-foreground">Estado</p>
            <div className="mt-2">
              {summary ? <Badge variant={STATUS_TONES[summary.status]}>{STATUS_LABELS[summary.status]}</Badge> : "—"}
            </div>
          </div>
        </div>
        <div className="mt-4 flex flex-wrap items-center gap-3">
          <Button onClick={handleRecalculate} disabled={recalcLoading || !saasId}>
            {recalcLoading ? "Recalculando..." : "Recalcular trimestre actual"}
          </Button>
          <p className="text-xs text-muted-foreground">
            Estimaciones demo. No sustituyen asesoría profesional ni modelos oficiales.
          </p>
        </div>
      </Card>

      <Card title="Histórico trimestral" subtitle="Últimos periodos calculados">
        {loading ? (
          <p className="text-sm text-muted-foreground">Cargando periodos...</p>
        ) : periods.length === 0 ? (
          <p className="text-sm text-muted-foreground">No hay periodos aún.</p>
        ) : (
          <div className="overflow-x-auto">
            <table className="w-full text-sm">
              <thead>
                <tr className="text-left text-muted-foreground">
                  <th className="py-2">Periodo</th>
                  <th className="py-2">Ingresos</th>
                  <th className="py-2">Gastos</th>
                  <th className="py-2">IVA</th>
                  <th className="py-2">IRPF</th>
                  <th className="py-2">Estado</th>
                </tr>
              </thead>
              <tbody>
                {periods.map((period) => (
                  <tr key={period.id} className="border-t border-white/5">
                    <td className="py-2 font-medium">{period.periodKey}</td>
                    <td className="py-2">{currencyFormatter.format(period.estimatedRevenue)}</td>
                    <td className="py-2">{currencyFormatter.format(period.estimatedExpenses)}</td>
                    <td className="py-2">{currencyFormatter.format(period.vatDue)}</td>
                    <td className="py-2">{currencyFormatter.format(period.incomeTaxDue)}</td>
                    <td className="py-2">
                      <Badge variant={period.vatDue > 1500 ? "err" : period.vatDue > 0 ? "warn" : "ok"}>
                        {period.status}
                      </Badge>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </Card>

      <Card title="Configuración fiscal" subtitle="Parámetros básicos (demo)">
        {!profile ? (
          <p className="text-sm text-muted-foreground">Sin perfil fiscal cargado.</p>
        ) : (
          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            <Field label="País">
              <TextInput value={profile.country} onChange={(event) => setProfile({ ...profile, country: event.target.value })} />
            </Field>
            <Field label="Región">
              <TextInput
                value={profile.region ?? ""}
                onChange={(event) => setProfile({ ...profile, region: event.target.value || null })}
              />
            </Field>
            <Field label="Régimen">
              <Select value={profile.regime} onChange={(event) => setProfile({ ...profile, regime: event.target.value })}>
                <option value="GENERAL">GENERAL</option>
                <option value="SIMPLIFIED">SIMPLIFIED</option>
                <option value="FLAT">FLAT</option>
              </Select>
            </Field>
            <Field label="IVA estándar (%)">
              <TextInput
                type="number"
                value={profile.defaultVatRate}
                onChange={(event) => setProfile({ ...profile, defaultVatRate: Number(event.target.value) })}
              />
            </Field>
            <Field label="IVA reducido (%)">
              <TextInput
                type="number"
                value={profile.reducedVatRate ?? 0}
                onChange={(event) => setProfile({ ...profile, reducedVatRate: Number(event.target.value) })}
              />
            </Field>
            <Field label="IVA super reducido (%)">
              <TextInput
                type="number"
                value={profile.superReducedVatRate ?? 0}
                onChange={(event) => setProfile({ ...profile, superReducedVatRate: Number(event.target.value) })}
              />
            </Field>
            <Field label="Retención aplicada">
              <Select
                value={profile.usesWithholding ? "yes" : "no"}
                onChange={(event) => setProfile({ ...profile, usesWithholding: event.target.value === "yes" })}
              >
                <option value="yes">Sí</option>
                <option value="no">No</option>
              </Select>
            </Field>
            <Field label="Retención (%)">
              <TextInput
                type="number"
                value={profile.withholdingRate}
                onChange={(event) => setProfile({ ...profile, withholdingRate: Number(event.target.value) })}
              />
            </Field>
            <Field label="Modo IRPF">
              <Select value={profile.incomeTaxMode} onChange={(event) => setProfile({ ...profile, incomeTaxMode: event.target.value })}>
                <option value="ESTIMATE_ONLY">ESTIMATE_ONLY</option>
                <option value="NONE">NONE</option>
              </Select>
            </Field>
          </div>
        )}
        <div className="mt-4 flex items-center gap-3">
          <Button onClick={handleSaveProfile} disabled={!profile || saving}>
            {saving ? "Guardando..." : "Guardar configuración"}
          </Button>
          <span className="text-xs text-muted-foreground">Parámetros demo. Ajusta con tu gestor antes de declarar.</span>
        </div>
      </Card>
    </section>
  );
}
