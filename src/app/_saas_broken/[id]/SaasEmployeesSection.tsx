// src/app/saas/[id]/SaasEmployeesSection.tsx
"use client";

import { useCallback, useEffect, useMemo, useState } from "react";
import { useRouter } from "next/navigation";
import Card from "@/components/ui/card";
import Button from "@/components/ui/button";
import Badge from "@/components/ui/badge";
import { Field, TextArea, TextInput } from "@/components/ui/input";
import type {
  ComplianceSummary,
  EmployeeComplianceIssue,
  EmployeeComplianceReport,
  EmployeeProfitabilityListItem,
  EmployeeProfitabilitySnapshot,
  EmployeeWithContext,
} from "@/lib/employees/types";
import SaasEmployeePartnerPanel from "@/app/saas/[id]/SaasEmployeePartnerPanel";
import SaasEmployeeWorkspacePanel from "@/app/saas/[id]/SaasEmployeeWorkspacePanel";

type Props = {
  saasId: string | null;
  saasName?: string | null;
};

const weekdayLabels = ["Domingo", "Lunes", "Martes", "Miércoles", "Jueves", "Viernes", "Sábado"];

function getComplianceBadgeVariant(status: "OK" | "WARNING" | "CRITICAL"): "ok" | "warn" | "err" {
  switch (status) {
    case "CRITICAL":
      return "err";
    case "WARNING":
      return "warn";
    default:
      return "ok";
  }
}

function getComplianceBadgeLabel(status: "OK" | "WARNING" | "CRITICAL"): string {
  switch (status) {
    case "CRITICAL":
      return "Critical";
    case "WARNING":
      return "Warning";
    default:
      return "OK";
  }
}

function formatHours(value?: number): string {
  if (typeof value !== "number" || Number.isNaN(value)) return "—";
  return `${value.toFixed(1)} h`;
}

function formatHourlyRate(value?: number): string {
  if (typeof value !== "number" || Number.isNaN(value)) return "—";
  return `${value.toFixed(2)} €/h`;
}

function formatCurrency(value?: number): string {
  if (typeof value !== "number" || Number.isNaN(value)) return "—";
  return `${value.toFixed(0)} €`;
}

function formatPercent(value?: number | null): string {
  if (typeof value !== "number" || Number.isNaN(value)) return "—";
  return `${value.toFixed(0)}%`;
}

function getProfitabilityBadge(status: EmployeeProfitabilityListItem["status"]): "ok" | "warn" | "err" | "neutral" {
  switch (status) {
    case "HEALTHY":
      return "ok";
    case "TIGHT":
      return "warn";
    case "UNPROFITABLE":
      return "err";
    default:
      return "neutral";
  }
}

function levelToStatus(level: EmployeeComplianceIssue["level"]): "OK" | "WARNING" | "CRITICAL" {
  if (level === "INFO") return "OK";
  return level;
}

const EMPTY_FORM = {
  fullName: "",
  email: "",
  phone: "",
  role: "",
  avatarUrl: "",
  notes: "",
  isActive: true,
};

export default function SaasEmployeesSection({ saasId, saasName }: Props) {
  const router = useRouter();
  const [employees, setEmployees] = useState<EmployeeWithContext[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [selectedId, setSelectedId] = useState<string | null>(null);
  const [form, setForm] = useState(EMPTY_FORM);
  const [saving, setSaving] = useState(false);
  const [skillForm, setSkillForm] = useState({ skill: "", level: "" });
  const [skillSaving, setSkillSaving] = useState(false);
  const [complianceSummary, setComplianceSummary] = useState<ComplianceSummary | null>(null);
  const [complianceLoading, setComplianceLoading] = useState(false);
  const [complianceError, setComplianceError] = useState<string | null>(null);
  const [employeeCompliance, setEmployeeCompliance] = useState<EmployeeComplianceReport | null>(null);
  const [employeeComplianceLoading, setEmployeeComplianceLoading] = useState(false);
  const [employeeComplianceError, setEmployeeComplianceError] = useState<string | null>(null);
  const [partnerEmployeeId, setPartnerEmployeeId] = useState<string | null>(null);
  const [profitability, setProfitability] = useState<EmployeeProfitabilityListItem[]>([]);
  const [profitabilityLoading, setProfitabilityLoading] = useState(false);
  const [profitabilityDetail, setProfitabilityDetail] = useState<EmployeeProfitabilitySnapshot | null>(null);
  const [profitabilityDetailLoading, setProfitabilityDetailLoading] = useState(false);
  const [profitabilityDetailError, setProfitabilityDetailError] = useState<string | null>(null);
  const [hrSettings, setHrSettings] = useState<{
    minHourlyWage: number;
    maxWeeklyHoursDefault: number;
    blockOverwork: boolean;
    blockUnderpay: boolean;
    minRestHoursBetweenShifts: number;
  } | null>(null);
  const [hrSettingsLoading, setHrSettingsLoading] = useState(false);
  const [hrSettingsSaving, setHrSettingsSaving] = useState(false);
  const [hrSettingsError, setHrSettingsError] = useState<string | null>(null);

  const selectedEmployee = useMemo(() => employees.find((emp) => emp.id === selectedId) ?? null, [employees, selectedId]);
  const profitabilityMap = useMemo(() => new Map(profitability.map((item) => [item.employeeId, item])), [profitability]);
  const closePartner = useCallback(() => setPartnerEmployeeId(null), []);
  const openPartner = useCallback((employeeId: string) => setPartnerEmployeeId(employeeId), []);
  const openWorkbench = useCallback(
    (employeeId: string) => {
      if (!saasId) return;
      router.push(`/staff/${encodeURIComponent(employeeId)}?saasId=${encodeURIComponent(saasId)}`);
    },
    [router, saasId],
  );

  const loadComplianceSummary = useCallback(async () => {
    if (!saasId) {
      setComplianceSummary(null);
      setComplianceError(null);
      setComplianceLoading(false);
      return;
    }
    setComplianceLoading(true);
    try {
      const res = await fetch(`/api/employees/compliance/summary?saasId=${encodeURIComponent(saasId)}`, { cache: "no-store" });
      if (!res.ok) {
        throw new Error("No se pudo cargar el estado de cumplimiento");
      }
      const data = (await res.json()) as ComplianceSummary;
      setComplianceSummary(data);
      setComplianceError(null);
    } catch (err) {
      setComplianceSummary(null);
      setComplianceError(err instanceof Error ? err.message : "No se pudo cargar el estado de cumplimiento");
    } finally {
      setComplianceLoading(false);
    }
  }, [saasId]);

  const loadEmployeeCompliance = useCallback(
    async (employeeId: string | null) => {
      if (!saasId || !employeeId) {
        setEmployeeCompliance(null);
        setEmployeeComplianceError(null);
        setEmployeeComplianceLoading(false);
        return;
      }
      setEmployeeComplianceLoading(true);
      try {
        const res = await fetch(`/api/employees/${encodeURIComponent(employeeId)}/compliance?saasId=${encodeURIComponent(saasId)}`, {
          cache: "no-store",
        });
        if (!res.ok) {
          throw new Error("No se pudo cargar el detalle de cumplimiento");
        }
        const data = (await res.json()) as EmployeeComplianceReport;
        setEmployeeCompliance(data);
        setEmployeeComplianceError(null);
      } catch (err) {
        setEmployeeCompliance(null);
        setEmployeeComplianceError(err instanceof Error ? err.message : "No se pudo cargar el detalle de cumplimiento");
      } finally {
        setEmployeeComplianceLoading(false);
      }
    },
    [saasId],
  );

  const loadEmployees = useCallback(async () => {
    if (!saasId) {
      setEmployees([]);
      setSelectedId(null);
      setLoading(false);
      return;
    }
    setLoading(true);
    try {
      const res = await fetch(`/api/employees?saasId=${encodeURIComponent(saasId)}`, { cache: "no-store" });
      if (!res.ok) {
        throw new Error("No se pudo cargar el equipo");
      }
      const data = (await res.json()) as { items?: EmployeeWithContext[] };
      const items = data.items ?? [];
      setEmployees(items);
      setSelectedId((prev) => {
        if (prev && items.some((emp) => emp.id === prev)) return prev;
        return items[0]?.id ?? null;
      });
      setError(null);
      void loadComplianceSummary();
    } catch (err) {
      setEmployees([]);
      setSelectedId(null);
      setError(err instanceof Error ? err.message : "No se pudo cargar el equipo");
    } finally {
      setLoading(false);
    }
  }, [loadComplianceSummary, saasId]);

  const loadProfitability = useCallback(async () => {
    if (!saasId) {
      setProfitability([]);
      setProfitabilityLoading(false);
      return;
    }
    setProfitabilityLoading(true);
    try {
      const res = await fetch(`/api/employees/profitability?saasId=${encodeURIComponent(saasId)}`, { cache: "no-store" });
      if (!res.ok) {
        throw new Error("No se pudo cargar la rentabilidad");
      }
      const data = (await res.json()) as { items?: EmployeeProfitabilityListItem[] };
      setProfitability(data.items ?? []);
    } catch {
      setProfitability([]);
    } finally {
      setProfitabilityLoading(false);
    }
  }, [saasId]);

  const loadProfitabilityDetail = useCallback(
    async (employeeId: string) => {
      if (!saasId) return;
      setProfitabilityDetailLoading(true);
      setProfitabilityDetailError(null);
      try {
        const res = await fetch(`/api/employees/${encodeURIComponent(employeeId)}/profitability?saasId=${encodeURIComponent(saasId)}`, {
          cache: "no-store",
        });
        if (!res.ok) {
          throw new Error("No se pudo cargar el detalle ROI");
        }
        const data = (await res.json()) as { snapshot?: EmployeeProfitabilitySnapshot };
        setProfitabilityDetail(data.snapshot ?? null);
      } catch (err) {
        setProfitabilityDetail(null);
        setProfitabilityDetailError(err instanceof Error ? err.message : "No se pudo cargar el detalle ROI");
      } finally {
        setProfitabilityDetailLoading(false);
      }
    },
    [saasId],
  );

  const loadHrSettings = useCallback(async () => {
    if (!saasId) {
      setHrSettings(null);
      setHrSettingsLoading(false);
      return;
    }
    setHrSettingsLoading(true);
    setHrSettingsError(null);
    try {
      const res = await fetch(`/api/employees/hr-settings?saasId=${encodeURIComponent(saasId)}`, { cache: "no-store" });
      if (!res.ok) {
        throw new Error("No se pudieron cargar los ajustes de HR");
      }
      const data = (await res.json()) as { settings?: typeof hrSettings };
      setHrSettings(data.settings ?? null);
    } catch (err) {
      setHrSettings(null);
      setHrSettingsError(err instanceof Error ? err.message : "No se pudieron cargar los ajustes de HR");
    } finally {
      setHrSettingsLoading(false);
    }
  }, [saasId]);

  useEffect(() => {
    void loadEmployees();
  }, [loadEmployees]);

  useEffect(() => {
    void loadProfitability();
  }, [loadProfitability]);

  useEffect(() => {
    void loadHrSettings();
  }, [loadHrSettings]);

  useEffect(() => {
    if (selectedEmployee) {
      setForm({
        fullName: selectedEmployee.fullName,
        email: selectedEmployee.email ?? "",
        phone: selectedEmployee.phone ?? "",
        role: selectedEmployee.role ?? "",
        avatarUrl: selectedEmployee.avatarUrl ?? "",
        notes: selectedEmployee.notes ?? "",
        isActive: selectedEmployee.isActive,
      });
    } else {
      setForm(EMPTY_FORM);
    }
  }, [selectedEmployee]);

  useEffect(() => {
    void loadEmployeeCompliance(selectedId);
  }, [loadEmployeeCompliance, selectedId]);

  useEffect(() => {
    setProfitabilityDetail(null);
    setProfitabilityDetailError(null);
  }, [selectedId]);

  const saveHrSettingsUpdates = useCallback(
    async (updates: Partial<NonNullable<typeof hrSettings>>) => {
      if (!saasId) return;
      setHrSettingsSaving(true);
      setHrSettingsError(null);
      try {
        const res = await fetch(`/api/employees/hr-settings?saasId=${encodeURIComponent(saasId)}`, {
          method: "PATCH",
          headers: { "content-type": "application/json" },
          body: JSON.stringify(updates),
        });
        if (!res.ok) {
          const body = (await res.json().catch(() => null)) as { message?: string } | null;
          throw new Error(body?.message ?? "No se pudieron guardar los ajustes");
        }
        const data = (await res.json()) as { settings?: typeof hrSettings };
        setHrSettings(data.settings ?? null);
      } catch (err) {
        setHrSettingsError(err instanceof Error ? err.message : "No se pudieron guardar los ajustes");
      } finally {
        setHrSettingsSaving(false);
      }
    },
    [saasId],
  );

  async function handleSubmit(event: React.FormEvent<HTMLFormElement>) {
    event.preventDefault();
    if (!saasId) {
      setError("Selecciona un SaaS para gestionar su equipo.");
      return;
    }
    if (!form.fullName.trim()) {
      setError("El nombre es obligatorio.");
      return;
    }
    setSaving(true);
    setError(null);
    try {
      const payload = {
        fullName: form.fullName.trim(),
        email: form.email.trim() ? form.email.trim() : null,
        phone: form.phone.trim() ? form.phone.trim() : null,
        role: form.role.trim() ? form.role.trim() : null,
        avatarUrl: form.avatarUrl.trim() ? form.avatarUrl.trim() : null,
        notes: form.notes.trim() ? form.notes.trim() : null,
        isActive: form.isActive,
        saasId,
      };
      if (selectedEmployee) {
        const res = await fetch(`/api/employees/${selectedEmployee.id}`, {
          method: "PATCH",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify(payload),
        });
        if (!res.ok) {
          const data = (await res.json().catch(() => null)) as { message?: string } | null;
          throw new Error(data?.message ?? "No se pudo actualizar al empleado");
        }
      } else {
        const res = await fetch("/api/employees", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify(payload),
        });
        if (!res.ok) {
          const data = (await res.json().catch(() => null)) as { message?: string } | null;
          throw new Error(data?.message ?? "No se pudo crear al empleado");
        }
      }
      await loadEmployees();
      if (!selectedEmployee) {
        setForm(EMPTY_FORM);
      }
      void loadComplianceSummary();
    } catch (err) {
      setError(err instanceof Error ? err.message : "No se pudo guardar el empleado");
    } finally {
      setSaving(false);
    }
  }

  async function handleAddSkill(event: React.FormEvent<HTMLFormElement>) {
    event.preventDefault();
    if (!selectedEmployee) {
      setError("Selecciona un empleado para añadir skills.");
      return;
    }
    if (!skillForm.skill.trim() || !skillForm.level.trim()) {
      setError("Completa el skill y el nivel.");
      return;
    }
    setSkillSaving(true);
    setError(null);
    try {
      const res = await fetch(`/api/employees/${selectedEmployee.id}/skills?saasId=${saasId ? encodeURIComponent(saasId) : ""}`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ skill: skillForm.skill, level: skillForm.level, saasId }),
      });
      if (!res.ok) {
        const data = (await res.json().catch(() => null)) as { message?: string } | null;
        throw new Error(data?.message ?? "No se pudo añadir el skill");
      }
      setSkillForm({ skill: "", level: "" });
      await loadEmployees();
    } catch (err) {
      setError(err instanceof Error ? err.message : "No se pudo añadir el skill");
    } finally {
      setSkillSaving(false);
    }
  }

  function startNewEmployee() {
    setSelectedId(null);
    setForm(EMPTY_FORM);
    setEmployeeCompliance(null);
    setEmployeeComplianceError(null);
  }

  const emptyState = !saasId ? "Selecciona un SaaS para gestionar empleados." : loading ? "Cargando equipo..." : "Sin empleados registrados.";

  return (
    <>
      <Card tone="glass" title="Equipo y Partner" subtitle="Gestiona empleados y prepara el contexto del Employee Partner">
      {!saasId ? (
        <p className="text-sm text-[var(--muted)]">{emptyState}</p>
      ) : (
        <div className="grid gap-6 lg:grid-cols-[1.5fr,1fr]">
          <div className="space-y-4">
            <div className="flex items-center justify-between gap-3">
              <div>
                <p className="text-sm text-[var(--muted)]">Personal asignado</p>
                <p className="text-xs text-[var(--muted)]">{saasName ?? saasId}</p>
              </div>
              <Button variant="outline" onClick={startNewEmployee}>
                Nuevo empleado
              </Button>
            </div>
            <div className="flex flex-wrap items-center gap-2 text-xs">
              {complianceLoading ? (
                <Badge variant="info">Evaluando Fairness Guard…</Badge>
              ) : complianceError ? (
                <Badge variant="err">{complianceError}</Badge>
              ) : complianceSummary ? (
                <>
                  <Badge variant="ok">OK {complianceSummary.okCount}</Badge>
                  <Badge variant="warn">Warning {complianceSummary.warningCount}</Badge>
                  <Badge variant="err">Critical {complianceSummary.criticalCount}</Badge>
                </>
              ) : null}
            </div>
            {error && (
              <div className="rounded-2xl border border-red-500/30 bg-red-900/20 px-4 py-2 text-sm text-red-100">
                {error}
              </div>
            )}
            {employees.length === 0 ? (
              <p className="text-sm text-[var(--muted)]">{emptyState}</p>
            ) : (
              <div className="overflow-x-auto rounded-2xl border border-[var(--border)] bg-[var(--panel)]/60">
                <table className="w-full text-sm">
                  <thead className="text-[var(--muted)]">
                    <tr>
                      <th className="px-4 py-2 text-left font-medium">Nombre</th>
                      <th className="px-4 py-2 text-left font-medium">Rol</th>
                      <th className="px-4 py-2 text-left font-medium">Ingresos</th>
                      <th className="px-4 py-2 text-left font-medium">Margen</th>
                      <th className="px-4 py-2 text-left font-medium">Uso</th>
                      <th className="px-4 py-2 text-left font-medium">ROI</th>
                      <th className="px-4 py-2 text-left font-medium">Estado</th>
                      <th className="px-4 py-2 text-left font-medium">SaaS</th>
                      <th className="px-4 py-2 text-left font-medium">Partner</th>
                      <th className="px-4 py-2 text-left font-medium">Detalle</th>
                      <th className="px-4 py-2 text-left font-medium">Workbench</th>
                    </tr>
                  </thead>
                  <tbody>
                    {employees.map((employee) => (
                      <tr
                        key={employee.id}
                        className={[
                          "cursor-pointer border-t border-[var(--border)]/60 transition",
                          selectedId === employee.id ? "bg-[var(--brand-quiet)]/30" : "hover:bg-[var(--panel)]/40",
                        ].join(" ")}
                        onClick={() => setSelectedId(employee.id)}
                      >
                        <td className="px-4 py-2 font-medium">{employee.fullName}</td>
                        <td className="px-4 py-2">
                          <div className="flex items-center gap-2">
                            <span>{employee.role ?? "—"}</span>
                            {(() => {
                              const statusEntry = complianceSummary?.employees.find((item) => item.employeeId === employee.id);
                              if (!statusEntry) return null;
                              return (
                                <Badge variant={getComplianceBadgeVariant(statusEntry.status)}>
                                  {getComplianceBadgeLabel(statusEntry.status)}
                                </Badge>
                              );
                            })()}
                          </div>
                        </td>
                        <td className="px-4 py-2">
                          {profitabilityLoading ? "—" : formatCurrency(profitabilityMap.get(employee.id)?.totalRevenue)}
                        </td>
                        <td className="px-4 py-2">
                          {profitabilityLoading ? "—" : formatPercent(profitabilityMap.get(employee.id)?.marginPercent ?? null)}
                        </td>
                        <td className="px-4 py-2">
                          {profitabilityLoading ? "—" : formatPercent(profitabilityMap.get(employee.id)?.utilizationPercent ?? null)}
                        </td>
                        <td className="px-4 py-2">
                          {profitabilityLoading ? (
                            <Badge variant="info">Cargando</Badge>
                          ) : (
                            <Badge variant={getProfitabilityBadge(profitabilityMap.get(employee.id)?.status ?? "LOW_ACTIVITY")}>
                              {profitabilityMap.get(employee.id)?.status ?? "LOW_ACTIVITY"}
                            </Badge>
                          )}
                        </td>
                        <td className="px-4 py-2">
                          {employee.isActive ? <Badge variant="ok">Activo</Badge> : <Badge variant="neutral">Pausado</Badge>}
                        </td>
                        <td className="px-4 py-2 text-[var(--muted)]">{saasName ?? employee.saasId}</td>
                        <td className="px-4 py-2">
                          <Button
                            variant="ghost"
                            size="sm"
                            onClick={(event) => {
                              event.stopPropagation();
                              openPartner(employee.id);
                            }}
                          >
                            Ver Partner
                          </Button>
                        </td>
                        <td className="px-4 py-2">
                          <Button
                            variant="outline"
                            size="sm"
                            onClick={(event) => {
                              event.stopPropagation();
                              void loadProfitabilityDetail(employee.id);
                            }}
                          >
                            Ver detalle ROI
                          </Button>
                        </td>
                        <td className="px-4 py-2">
                          <Button
                            variant="outline"
                            size="sm"
                            onClick={(event) => {
                              event.stopPropagation();
                              openWorkbench(employee.id);
                            }}
                          >
                            Abrir Workbench
                          </Button>
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            )}
          </div>
          <div className="space-y-4 rounded-3xl border border-[var(--border)] bg-[var(--panel)]/70 p-4">
            <div className="flex items-center justify-between">
              <div>
                <p className="text-xs uppercase tracking-[0.3em] text-[var(--muted)]">{selectedEmployee ? "Editar" : "Nuevo"}</p>
                <h3 className="text-lg font-semibold">{selectedEmployee ? selectedEmployee.fullName : "Ficha de empleado"}</h3>
              </div>
              {selectedEmployee && (
                <Badge variant="info" aria-label="Estado del empleado">
                  {selectedEmployee.isActive ? "Activo" : "Pausado"}
                </Badge>
              )}
            </div>
            <form onSubmit={handleSubmit} className="space-y-3">
              <Field label="Nombre completo">
                <TextInput value={form.fullName} onChange={(e) => setForm((prev) => ({ ...prev, fullName: e.target.value }))} required />
              </Field>
              <div className="grid gap-3 md:grid-cols-2">
                <Field label="Email">
                  <TextInput value={form.email} onChange={(e) => setForm((prev) => ({ ...prev, email: e.target.value }))} />
                </Field>
                <Field label="Teléfono">
                  <TextInput value={form.phone} onChange={(e) => setForm((prev) => ({ ...prev, phone: e.target.value }))} />
                </Field>
              </div>
              <Field label="Rol">
                <TextInput value={form.role} onChange={(e) => setForm((prev) => ({ ...prev, role: e.target.value }))} />
              </Field>
              <Field label="Avatar (URL)">
                <TextInput value={form.avatarUrl} onChange={(e) => setForm((prev) => ({ ...prev, avatarUrl: e.target.value }))} />
              </Field>
              <Field label="Notas">
                <TextArea rows={3} value={form.notes} onChange={(e) => setForm((prev) => ({ ...prev, notes: e.target.value }))} />
              </Field>
              <label className="flex items-center gap-2 text-sm text-[var(--muted)]">
                <input
                  type="checkbox"
                  checked={form.isActive}
                  onChange={(e) => setForm((prev) => ({ ...prev, isActive: e.target.checked }))}
                  className="h-4 w-4 rounded border-[var(--border)]"
                />
                Activo en agenda
              </label>
              <Button type="submit" disabled={saving}>
                {saving ? "Guardando..." : selectedEmployee ? "Actualizar empleado" : "Crear empleado"}
              </Button>
            </form>

            {selectedEmployee ? (
              <div className="space-y-3 rounded-2xl border border-[var(--border)] bg-[var(--background)]/80 p-4">
                <div className="flex items-center justify-between">
                  <h4 className="text-sm font-semibold">Fairness Guard</h4>
                  {employeeCompliance && (
                    <Badge variant={getComplianceBadgeVariant(employeeCompliance.status)}>
                      {getComplianceBadgeLabel(employeeCompliance.status)}
                    </Badge>
                  )}
                </div>
                {employeeComplianceLoading ? (
                  <p className="text-xs text-[var(--muted)]">Calculando cumplimiento…</p>
                ) : employeeComplianceError ? (
                  <p className="text-xs text-red-400">{employeeComplianceError}</p>
                ) : employeeCompliance ? (
                  <div className="space-y-3">
                    <div className="grid grid-cols-2 gap-2 text-xs text-[var(--muted)]">
                      <span>
                        Planificadas: <strong>{formatHours(employeeCompliance.metrics.plannedHours)}</strong>
                      </span>
                      <span>
                        Reales: <strong>{formatHours(employeeCompliance.metrics.actualHours)}</strong>
                      </span>
                      <span>
                        Extra: <strong>{formatHours(employeeCompliance.metrics.extraHours)}</strong>
                      </span>
                      <span>
                        Límite semanal: <strong>{formatHours(employeeCompliance.metrics.maxHoursWeek)}</strong>
                      </span>
                      <span>
                        Tarifa efectiva: <strong>{formatHourlyRate(employeeCompliance.metrics.effectiveHourlyRate)}</strong>
                      </span>
                    </div>
                    <div className="space-y-2">
                      <h5 className="text-xs font-semibold text-[var(--muted)]">Incidencias</h5>
                      {employeeCompliance.issues.length === 0 ? (
                        <p className="text-xs text-[var(--muted)]">Sin incidencias detectadas.</p>
                      ) : (
                        <ul className="space-y-1 text-xs text-[var(--muted)]">
                          {employeeCompliance.issues.map((issue, idx) => (
                            <li key={`${issue.type}-${idx}`}>
                              <Badge variant={getComplianceBadgeVariant(levelToStatus(issue.level))} className="mr-2">
                                {issue.level}
                              </Badge>
                              {issue.message}
                            </li>
                          ))}
                        </ul>
                      )}
                    </div>
                  </div>
                ) : (
                  <p className="text-xs text-[var(--muted)]">Selecciona un empleado para revisar su estado.</p>
                )}
              </div>
            ) : null}

            <div className="space-y-3 rounded-2xl border border-[var(--border)] bg-[var(--background)]/80 p-4">
              <div className="flex items-center justify-between">
                <h4 className="text-sm font-semibold">Fairness Enforcement</h4>
                {hrSettings && (
                  <Badge variant={hrSettings.blockOverwork || hrSettings.blockUnderpay ? "warn" : "neutral"}>
                    {hrSettings.blockOverwork || hrSettings.blockUnderpay ? "Bloqueos activos" : "Solo avisos"}
                  </Badge>
                )}
              </div>
              {hrSettingsLoading ? (
                <p className="text-xs text-[var(--muted)]">Cargando ajustes…</p>
              ) : hrSettingsError ? (
                <p className="text-xs text-red-400">{hrSettingsError}</p>
              ) : hrSettings ? (
                <div className="space-y-3 text-xs text-[var(--muted)]">
                  <label className="flex items-center gap-2">
                    <input
                      type="checkbox"
                      checked={hrSettings.blockOverwork}
                      onChange={(event) => {
                        const next = event.target.checked;
                        setHrSettings((prev) => (prev ? { ...prev, blockOverwork: next } : prev));
                        void saveHrSettingsUpdates({ blockOverwork: next });
                      }}
                      className="h-4 w-4 rounded border-[var(--border)]"
                      disabled={hrSettingsSaving}
                    />
                    Bloquear sobrecarga (overwork)
                  </label>
                  <label className="flex items-center gap-2">
                    <input
                      type="checkbox"
                      checked={hrSettings.blockUnderpay}
                      onChange={(event) => {
                        const next = event.target.checked;
                        setHrSettings((prev) => (prev ? { ...prev, blockUnderpay: next } : prev));
                        void saveHrSettingsUpdates({ blockUnderpay: next });
                      }}
                      className="h-4 w-4 rounded border-[var(--border)]"
                      disabled={hrSettingsSaving}
                    />
                    Bloquear subpago (underpay)
                  </label>
                  <label className="text-xs text-[var(--muted)]">
                    Descanso mínimo entre turnos (h)
                    <TextInput
                      type="number"
                      min={0}
                      value={hrSettings.minRestHoursBetweenShifts}
                      onChange={(event) => {
                        const numericValue = Number(event.target.value);
                        if (!Number.isFinite(numericValue)) return;
                        const value = Math.max(0, numericValue);
                        setHrSettings((prev) => (prev ? { ...prev, minRestHoursBetweenShifts: value } : prev));
                      }}
                      onBlur={(event) => {
                        const numericValue = Number(event.target.value);
                        if (!Number.isFinite(numericValue)) return;
                        const value = Math.max(0, numericValue);
                        void saveHrSettingsUpdates({ minRestHoursBetweenShifts: value });
                      }}
                      disabled={hrSettingsSaving}
                    />
                  </label>
                </div>
              ) : (
                <p className="text-xs text-[var(--muted)]">Sin ajustes disponibles.</p>
              )}
            </div>

            {selectedEmployee ? (
              <div className="space-y-3 rounded-2xl border border-[var(--border)] bg-[var(--background)]/80 p-4">
                <div className="flex items-center justify-between">
                  <h4 className="text-sm font-semibold">Rentabilidad (ROI)</h4>
                  {profitabilityDetail && (
                    <Badge variant={getProfitabilityBadge(profitabilityDetail.status)}>
                      {profitabilityDetail.status}
                    </Badge>
                  )}
                </div>
                {profitabilityDetailLoading ? (
                  <p className="text-xs text-[var(--muted)]">Calculando rentabilidad…</p>
                ) : profitabilityDetailError ? (
                  <p className="text-xs text-red-400">{profitabilityDetailError}</p>
                ) : profitabilityDetail ? (
                  <div className="space-y-3 text-xs text-[var(--muted)]">
                    <div className="grid grid-cols-2 gap-2">
                      <span>
                        Ingresos: <strong>{formatCurrency(profitabilityDetail.totalRevenue)}</strong>
                      </span>
                      <span>
                        Coste productos: <strong>{formatCurrency(profitabilityDetail.productCosts)}</strong>
                      </span>
                      <span>
                        Coste nómina: <strong>{formatCurrency(profitabilityDetail.payrollCosts)}</strong>
                      </span>
                      <span>
                        Margen %: <strong>{formatPercent(profitabilityDetail.marginPercent)}</strong>
                      </span>
                      <span>
                        Margen total: <strong>{formatCurrency(profitabilityDetail.marginAbsolute)}</strong>
                      </span>
                      <span>
                        Uso: <strong>{formatPercent(profitabilityDetail.utilizationPercent)}</strong>
                      </span>
                      <span>
                        Horas reservadas: <strong>{formatHours(profitabilityDetail.hoursBooked)}</strong>
                      </span>
                      <span>
                        Margen/hora: <strong>{formatCurrency(profitabilityDetail.effectiveHourlyMargin)}</strong>
                      </span>
                    </div>
                    <p className="text-xs text-[var(--muted)]">{profitabilityDetail.notes}</p>
                  </div>
                ) : (
                  <p className="text-xs text-[var(--muted)]">Pulsa “Ver detalle ROI” en la tabla para cargarlo.</p>
                )}
              </div>
            ) : null}

            <div className="space-y-3 rounded-2xl border border-[var(--border)] bg-[var(--background)]/70 p-4">
              <div className="flex items-center justify-between">
                <h4 className="text-sm font-semibold">Skills</h4>
                {selectedEmployee && <span className="text-xs text-[var(--muted)]">{selectedEmployee.skills.length} registrados</span>}
              </div>
              <div className="flex flex-wrap gap-2">
                {selectedEmployee && selectedEmployee.skills.length > 0 ? (
                  selectedEmployee.skills.map((skill) => (
                    <span key={skill.id} className="rounded-full border border-[var(--border)] px-3 py-1 text-xs text-[var(--muted)]">
                      {skill.skill} · {skill.level}
                    </span>
                  ))
                ) : (
                  <p className="text-xs text-[var(--muted)]">Sin skills todavía.</p>
                )}
              </div>
              <form onSubmit={handleAddSkill} className="grid gap-2 md:grid-cols-2">
                <TextInput
                  placeholder="Skill"
                  value={skillForm.skill}
                  onChange={(e) => setSkillForm((prev) => ({ ...prev, skill: e.target.value }))}
                  disabled={!selectedEmployee}
                />
                <div className="flex gap-2">
                  <TextInput
                    placeholder="Nivel"
                    value={skillForm.level}
                    onChange={(e) => setSkillForm((prev) => ({ ...prev, level: e.target.value }))}
                    disabled={!selectedEmployee}
                  />
                  <Button type="submit" disabled={!selectedEmployee || skillSaving}>
                    {skillSaving ? "Añadiendo..." : "Añadir"}
                  </Button>
                </div>
              </form>
            </div>

            <div className="space-y-2 rounded-2xl border border-[var(--border)] bg-[var(--background)]/70 p-4">
              <h4 className="text-sm font-semibold">Horarios</h4>
              {selectedEmployee && selectedEmployee.schedules.length > 0 ? (
                <ul className="space-y-1 text-sm text-[var(--muted)]">
                  {selectedEmployee.schedules.map((schedule) => (
                    <li key={schedule.id}>
                      {weekdayLabels[schedule.dayOfWeek % 7]} · {schedule.startTime} - {schedule.endTime}
                    </li>
                  ))}
                </ul>
              ) : (
                <p className="text-xs text-[var(--muted)]">Añade horarios desde el módulo de agenda.</p>
              )}
            </div>
          </div>
        </div>
      )}
      </Card>
      {selectedEmployee && saasId ? (
        <SaasEmployeeWorkspacePanel employeeId={selectedEmployee.id} saasId={saasId} employeeName={selectedEmployee.fullName} />
      ) : null}
      {partnerEmployeeId && saasId ? (
        <SaasEmployeePartnerPanel employeeId={partnerEmployeeId} saasId={saasId} onClose={closePartner} />
      ) : null}
    </>
  );
}
