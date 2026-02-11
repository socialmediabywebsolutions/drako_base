"use client";

import { useCallback, useEffect, useMemo, useState } from "react";
import Card from "@/components/ui/card";
import Button from "@/components/ui/button";
import Select from "@/components/ui/select";
import { TextInput } from "@/components/ui/input";
import EmptyState from "@/components/ui/empty-state";
import type { BrandingLayoutDensity, SaasBrandingSettings } from "@/lib/branding/types";

type Props = {
  saasId: string | null;
};

const DEFAULT_SETTINGS: Omit<SaasBrandingSettings, "id" | "tenantId" | "saasId" | "createdAt" | "updatedAt"> = {
  primaryColor: "#1f2937",
  secondaryColor: "#475569",
  accentColor: "#f59e0b",
  backgroundColor: "#0b0b0f",
  surfaceColor: "#14141d",
  textColor: "#f5f5f5",
  dangerColor: "#ef4444",
  successColor: "#22c55e",
  logoUrl: null,
  faviconUrl: null,
  heroImageUrl: null,
  layoutDensity: "NORMAL",
  enableDarkMode: true,
  metadata: null,
};

const DENSITY_LABELS: Record<BrandingLayoutDensity, string> = {
  COMPACT: "Compacto",
  NORMAL: "Normal",
  COZY: "Amplio",
};

export default function SaasBrandingSection({ saasId }: Props) {
  const [settings, setSettings] = useState<typeof DEFAULT_SETTINGS | null>(null);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const loadSettings = useCallback(async () => {
    if (!saasId) return;
    setLoading(true);
    try {
      const res = await fetch(`/api/branding/settings?saasId=${encodeURIComponent(saasId)}`, { cache: "no-store" });
      const data = (await res.json().catch(() => null)) as { settings?: SaasBrandingSettings | null } | null;
      const loaded = data?.settings;
      setSettings(
        loaded
          ? {
              primaryColor: loaded.primaryColor,
              secondaryColor: loaded.secondaryColor,
              accentColor: loaded.accentColor,
              backgroundColor: loaded.backgroundColor,
              surfaceColor: loaded.surfaceColor,
              textColor: loaded.textColor,
              dangerColor: loaded.dangerColor,
              successColor: loaded.successColor,
              logoUrl: loaded.logoUrl ?? null,
              faviconUrl: loaded.faviconUrl ?? null,
              heroImageUrl: loaded.heroImageUrl ?? null,
              layoutDensity: loaded.layoutDensity,
              enableDarkMode: loaded.enableDarkMode,
              metadata: loaded.metadata ?? null,
            }
          : { ...DEFAULT_SETTINGS },
      );
    } catch (err) {
      setError(err instanceof Error ? err.message : "No se pudo cargar el branding");
    } finally {
      setLoading(false);
    }
  }, [saasId]);

  useEffect(() => {
    void loadSettings();
  }, [loadSettings]);

  const previewStyles = useMemo(() => {
    if (!settings) return null;
    return {
      backgroundColor: settings.backgroundColor,
      color: settings.textColor,
      borderColor: settings.surfaceColor,
    } as React.CSSProperties;
  }, [settings]);

  async function save() {
    if (!saasId || !settings) return;
    setSaving(true);
    setError(null);
    try {
      const res = await fetch("/api/branding/settings", {
        method: "PATCH",
        headers: { "content-type": "application/json" },
        body: JSON.stringify({ saasId, ...settings }),
      });
      if (!res.ok) {
        throw new Error("No se pudo guardar el branding");
      }
      await loadSettings();
    } catch (err) {
      setError(err instanceof Error ? err.message : "No se pudo guardar el branding");
    } finally {
      setSaving(false);
    }
  }

  if (!saasId) return null;

  return (
    <Card title="Branding & Layout" subtitle="Personaliza colores y densidad de la interfaz">
      {loading ? (
        <p className="text-sm text-[var(--muted)]">Cargando branding...</p>
      ) : !settings ? (
        <EmptyState title="Sin branding" subtitle="Añade colores y logo para el SaaS." />
      ) : (
        <div className="grid gap-6 lg:grid-cols-[1.1fr_0.9fr]">
          <div className="grid gap-4 md:grid-cols-2">
            <div>
              <label className="mb-2 block text-xs font-semibold uppercase tracking-[0.3em] text-[var(--muted)]">Primary</label>
              <TextInput
                value={settings.primaryColor}
                onChange={(event) => setSettings({ ...settings, primaryColor: event.target.value })}
                placeholder="#00bcd4"
              />
            </div>
            <div>
              <label className="mb-2 block text-xs font-semibold uppercase tracking-[0.3em] text-[var(--muted)]">Secondary</label>
              <TextInput
                value={settings.secondaryColor}
                onChange={(event) => setSettings({ ...settings, secondaryColor: event.target.value })}
                placeholder="#006064"
              />
            </div>
            <div>
              <label className="mb-2 block text-xs font-semibold uppercase tracking-[0.3em] text-[var(--muted)]">Accent</label>
              <TextInput
                value={settings.accentColor}
                onChange={(event) => setSettings({ ...settings, accentColor: event.target.value })}
                placeholder="#ffca28"
              />
            </div>
            <div>
              <label className="mb-2 block text-xs font-semibold uppercase tracking-[0.3em] text-[var(--muted)]">Background</label>
              <TextInput
                value={settings.backgroundColor}
                onChange={(event) => setSettings({ ...settings, backgroundColor: event.target.value })}
                placeholder="#0b0b0f"
              />
            </div>
            <div>
              <label className="mb-2 block text-xs font-semibold uppercase tracking-[0.3em] text-[var(--muted)]">Surface</label>
              <TextInput
                value={settings.surfaceColor}
                onChange={(event) => setSettings({ ...settings, surfaceColor: event.target.value })}
                placeholder="#12121a"
              />
            </div>
            <div>
              <label className="mb-2 block text-xs font-semibold uppercase tracking-[0.3em] text-[var(--muted)]">Text</label>
              <TextInput
                value={settings.textColor}
                onChange={(event) => setSettings({ ...settings, textColor: event.target.value })}
                placeholder="#f5f5f5"
              />
            </div>
            <div>
              <label className="mb-2 block text-xs font-semibold uppercase tracking-[0.3em] text-[var(--muted)]">Danger</label>
              <TextInput
                value={settings.dangerColor}
                onChange={(event) => setSettings({ ...settings, dangerColor: event.target.value })}
                placeholder="#ef5350"
              />
            </div>
            <div>
              <label className="mb-2 block text-xs font-semibold uppercase tracking-[0.3em] text-[var(--muted)]">Success</label>
              <TextInput
                value={settings.successColor}
                onChange={(event) => setSettings({ ...settings, successColor: event.target.value })}
                placeholder="#66bb6a"
              />
            </div>
            <div>
              <label className="mb-2 block text-xs font-semibold uppercase tracking-[0.3em] text-[var(--muted)]">Logo URL</label>
              <TextInput
                value={settings.logoUrl ?? ""}
                onChange={(event) => setSettings({ ...settings, logoUrl: event.target.value || null })}
                placeholder="https://..."
              />
            </div>
            <div>
              <label className="mb-2 block text-xs font-semibold uppercase tracking-[0.3em] text-[var(--muted)]">Favicon URL</label>
              <TextInput
                value={settings.faviconUrl ?? ""}
                onChange={(event) => setSettings({ ...settings, faviconUrl: event.target.value || null })}
                placeholder="https://..."
              />
            </div>
            <div>
              <label className="mb-2 block text-xs font-semibold uppercase tracking-[0.3em] text-[var(--muted)]">Hero image</label>
              <TextInput
                value={settings.heroImageUrl ?? ""}
                onChange={(event) => setSettings({ ...settings, heroImageUrl: event.target.value || null })}
                placeholder="https://..."
              />
            </div>
            <div className="md:col-span-2">
              <label className="mb-2 block text-xs font-semibold uppercase tracking-[0.3em] text-[var(--muted)]">
                Densidad de layout
              </label>
              <Select
                value={settings.layoutDensity}
                onChange={(event) =>
                  setSettings({ ...settings, layoutDensity: event.target.value as BrandingLayoutDensity })
                }
              >
                {Object.entries(DENSITY_LABELS).map(([value, label]) => (
                  <option key={value} value={value}>
                    {label}
                  </option>
                ))}
              </Select>
              <label className="mt-3 flex items-center gap-2 text-xs text-[var(--muted)]">
                <input
                  type="checkbox"
                  checked={settings.enableDarkMode}
                  onChange={(event) => setSettings({ ...settings, enableDarkMode: event.target.checked })}
                />
                Habilitar dark mode
              </label>
            </div>
          </div>

          <div className="rounded-2xl border border-[var(--border)]/60 p-4" style={previewStyles ?? undefined}>
            <p className="text-xs uppercase tracking-[0.3em] text-[var(--muted)]">Preview</p>
            <div
              className="mt-4 rounded-2xl p-4"
              style={{ backgroundColor: settings.surfaceColor, color: settings.textColor }}
            >
              <p className="text-sm font-semibold">Panel del SaaS</p>
              <p className="text-xs text-[var(--muted)]">Este bloque usa surface + text.</p>
              <div className="mt-3 flex flex-wrap gap-2">
                <span
                  className="rounded-full px-3 py-1 text-xs font-semibold"
                  style={{ backgroundColor: settings.primaryColor, color: settings.textColor }}
                >
                  Primary
                </span>
                <span
                  className="rounded-full px-3 py-1 text-xs font-semibold"
                  style={{ backgroundColor: settings.accentColor, color: settings.backgroundColor }}
                >
                  Accent
                </span>
              </div>
            </div>
          </div>
        </div>
      )}

      {error && <p className="mt-3 text-xs text-[var(--danger)]">{error}</p>}

      <div className="mt-4 flex items-center justify-between text-xs text-[var(--muted)]">
        <p>Este branding aplica al portal publico y Staff Portal. Cada empleado puede ajustar su densidad.</p>
        <Button onClick={save} disabled={saving || !settings}>
          {saving ? "Guardando..." : "Guardar branding"}
        </Button>
      </div>
    </Card>
  );
}
