import { env as resolveEnv, type DracoEnv } from "@/lib/cf";
import { DEMO_TENANT_ID } from "@/lib/tenants/services";
import {
  getDemoBrandingForSaas,
  getDemoUserPreferences,
  upsertDemoBrandingSettings,
  upsertDemoUserPreferences,
} from "@/lib/admin/demo-data";
import type {
  BrandingLayoutDensity,
  BrandingRoleType,
  ResolvedTheme,
  SaasBrandingSettings,
  SaasUserUiPreferences,
} from "@/lib/branding/types";

export type BrandingContextMode = "d1" | "demo";

export type BrandingContext = {
  tenantId: string;
  saasId: string | null;
  mode: BrandingContextMode;
  allowDemoFallback: boolean;
  demoTenantId?: string;
  db?: D1Database;
  env?: DracoEnv | null;
};

const FALLBACK_ERROR_PATTERNS = ["no such table", "no such column"];

const DEFAULT_THEME: ResolvedTheme = {
  colors: {
    primary: "#1f2937",
    secondary: "#475569",
    accent: "#f59e0b",
    background: "#0b0b0f",
    surface: "#14141d",
    text: "#f5f5f5",
    danger: "#ef4444",
    success: "#22c55e",
  },
  layoutDensity: "NORMAL",
  logoUrl: null,
  heroImageUrl: null,
  effectiveDarkMode: true,
};

function resolveEnvOverride(envOverride?: DracoEnv | null): DracoEnv | null {
  if (envOverride) return envOverride;
  return resolveEnv();
}

function hasDatabase(envOverride?: DracoEnv | null): boolean {
  return Boolean(resolveEnvOverride(envOverride)?.DRACO_DB);
}

function isDemoFeatureEnabled(tenantId: string, envOverride?: DracoEnv | null): boolean {
  if (tenantId === DEMO_TENANT_ID) return true;
  const runtimeEnv = resolveEnvOverride(envOverride);
  const flag = runtimeEnv?.DRAKO_DEMO_MODE ?? process.env.DRAKO_DEMO_MODE;
  return typeof flag === "string" && flag.toLowerCase() === "true";
}

function shouldFallbackToDemo(error: unknown, ctx: BrandingContext): boolean {
  if (ctx.mode !== "d1" || !ctx.allowDemoFallback) return false;
  const message = (error instanceof Error ? error.message : `${error ?? ""}`).toLowerCase();
  return FALLBACK_ERROR_PATTERNS.some((pattern) => message.includes(pattern));
}

function requireSaasId(ctx: BrandingContext): string {
  const saasId = ctx.saasId?.trim();
  if (!saasId) {
    throw new Error("saasId is required for branding operations.");
  }
  return saasId;
}

function parseMetadata(raw: string | null): Record<string, unknown> | null {
  if (!raw) return null;
  try {
    return JSON.parse(raw) as Record<string, unknown>;
  } catch {
    return null;
  }
}

function serializeMetadata(metadata: Record<string, unknown> | null | undefined): string | null {
  if (!metadata) return null;
  try {
    return JSON.stringify(metadata);
  } catch {
    return null;
  }
}

function parseHiddenWidgets(raw: string | null): string[] | null {
  if (!raw) return null;
  try {
    const parsed = JSON.parse(raw);
    return Array.isArray(parsed) ? parsed.map((item) => String(item)) : null;
  } catch {
    return null;
  }
}

function serializeHiddenWidgets(items: string[] | null | undefined): string | null {
  if (!items) return null;
  try {
    return JSON.stringify(items);
  } catch {
    return null;
  }
}

type BrandingRow = {
  id: string;
  tenant_id: string;
  saas_id: string;
  primary_color: string;
  secondary_color: string;
  accent_color: string;
  background_color: string;
  surface_color: string;
  text_color: string;
  danger_color: string;
  success_color: string;
  logo_url: string | null;
  favicon_url: string | null;
  hero_image_url: string | null;
  layout_density: string;
  enable_dark_mode: number;
  metadata: string | null;
  created_at: string;
  updated_at: string;
};

type PreferenceRow = {
  id: string;
  tenant_id: string;
  saas_id: string;
  user_id: string;
  role_type: string;
  layout_density_override: string | null;
  default_section: string | null;
  hidden_widgets: string | null;
  metadata: string | null;
  created_at: string;
  updated_at: string;
};

function mapBrandingRow(row: BrandingRow): SaasBrandingSettings {
  return {
    id: row.id,
    tenantId: row.tenant_id,
    saasId: row.saas_id,
    primaryColor: row.primary_color,
    secondaryColor: row.secondary_color,
    accentColor: row.accent_color,
    backgroundColor: row.background_color,
    surfaceColor: row.surface_color,
    textColor: row.text_color,
    dangerColor: row.danger_color,
    successColor: row.success_color,
    logoUrl: row.logo_url,
    faviconUrl: row.favicon_url,
    heroImageUrl: row.hero_image_url,
    layoutDensity: row.layout_density as BrandingLayoutDensity,
    enableDarkMode: row.enable_dark_mode === 1,
    metadata: parseMetadata(row.metadata),
    createdAt: row.created_at,
    updatedAt: row.updated_at,
  };
}

function mapPreferenceRow(row: PreferenceRow): SaasUserUiPreferences {
  return {
    id: row.id,
    tenantId: row.tenant_id,
    saasId: row.saas_id,
    userId: row.user_id,
    roleType: row.role_type as BrandingRoleType,
    layoutDensityOverride: (row.layout_density_override as BrandingLayoutDensity | null) ?? null,
    defaultSection: row.default_section ?? null,
    hiddenWidgets: parseHiddenWidgets(row.hidden_widgets),
    metadata: parseMetadata(row.metadata),
    createdAt: row.created_at,
    updatedAt: row.updated_at,
  };
}

export async function resolveBrandingContext({
  tenantId,
  saasId,
  env,
}: {
  tenantId: string;
  saasId?: string | null;
  env?: DracoEnv | null;
}): Promise<BrandingContext> {
  const normalizedSaasId = saasId?.trim() ?? null;
  const demoEnabled = isDemoFeatureEnabled(tenantId, env);

  if (hasDatabase(env)) {
    const runtimeEnv = resolveEnvOverride(env);
    return {
      tenantId,
      saasId: normalizedSaasId,
      mode: "d1",
      allowDemoFallback: demoEnabled,
      demoTenantId: demoEnabled ? DEMO_TENANT_ID : undefined,
      db: runtimeEnv?.DRACO_DB,
      env: runtimeEnv,
    };
  }

  if (!demoEnabled) {
    throw new Error("Branding module is not enabled for this tenant.");
  }

  return {
    tenantId,
    saasId: normalizedSaasId,
    mode: "demo",
    allowDemoFallback: true,
    demoTenantId: DEMO_TENANT_ID,
    env,
  };
}

async function queryAllWithCtx<T>(ctx: BrandingContext, sql: string, ...params: unknown[]): Promise<T[]> {
  if (ctx.mode !== "d1") return [];
  const db = ctx.db ?? resolveEnvOverride(ctx.env)?.DRACO_DB;
  if (!db) return [];
  const stmt = db.prepare(sql);
  const bound = params.length ? stmt.bind(...params) : stmt;
  const res = await bound.all<T>();
  return res.results ?? [];
}

async function runWithCtx(ctx: BrandingContext, sql: string, ...params: unknown[]): Promise<boolean> {
  if (ctx.mode !== "d1") return false;
  const db = ctx.db ?? resolveEnvOverride(ctx.env)?.DRACO_DB;
  if (!db) return false;
  const stmt = db.prepare(sql);
  const bound = params.length ? stmt.bind(...params) : stmt;
  const res = await bound.run();
  return Boolean(res?.success);
}

export async function getSaasBrandingSettings(ctx: BrandingContext): Promise<SaasBrandingSettings | null> {
  const saasId = requireSaasId(ctx);
  if (ctx.mode === "demo") {
    const record = getDemoBrandingForSaas(ctx.demoTenantId ?? ctx.tenantId, saasId);
    return record ? mapBrandingRow(record) : null;
  }
  try {
    const rows = await queryAllWithCtx<BrandingRow>(
      ctx,
      `SELECT * FROM saas_branding_settings WHERE tenant_id = ? AND saas_id = ? LIMIT 1`,
      ctx.tenantId,
      saasId,
    );
    return rows[0] ? mapBrandingRow(rows[0]) : null;
  } catch (error) {
    if (shouldFallbackToDemo(error, ctx)) {
      const record = getDemoBrandingForSaas(ctx.demoTenantId ?? ctx.tenantId, saasId);
      return record ? mapBrandingRow(record) : null;
    }
    throw error;
  }
}

export async function upsertSaasBrandingSettings(
  ctx: BrandingContext,
  input: Omit<SaasBrandingSettings, "id" | "tenantId" | "saasId" | "createdAt" | "updatedAt"> & { saasId: string },
): Promise<SaasBrandingSettings> {
  const saasId = input.saasId?.trim() ?? requireSaasId(ctx);
  const now = new Date().toISOString();
  const existing = await getSaasBrandingSettings(ctx);
  const id = existing?.id ?? `${Date.now()}-${Math.random().toString(16).slice(2)}`;

  if (ctx.mode === "demo") {
    const record = upsertDemoBrandingSettings(ctx.demoTenantId ?? ctx.tenantId, {
      id,
      saas_id: saasId,
      primary_color: input.primaryColor,
      secondary_color: input.secondaryColor,
      accent_color: input.accentColor,
      background_color: input.backgroundColor,
      surface_color: input.surfaceColor,
      text_color: input.textColor,
      danger_color: input.dangerColor,
      success_color: input.successColor,
      logo_url: input.logoUrl ?? null,
      favicon_url: input.faviconUrl ?? null,
      hero_image_url: input.heroImageUrl ?? null,
      layout_density: input.layoutDensity,
      enable_dark_mode: input.enableDarkMode ? 1 : 0,
      metadata: serializeMetadata(input.metadata),
    });
    return mapBrandingRow(record);
  }

  await runWithCtx(
    ctx,
    `INSERT INTO saas_branding_settings (
      id, tenant_id, saas_id, primary_color, secondary_color, accent_color, background_color, surface_color,
      text_color, danger_color, success_color, logo_url, favicon_url, hero_image_url, layout_density, enable_dark_mode,
      metadata, created_at, updated_at
    ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
    ON CONFLICT(tenant_id, saas_id) DO UPDATE SET
      primary_color = excluded.primary_color,
      secondary_color = excluded.secondary_color,
      accent_color = excluded.accent_color,
      background_color = excluded.background_color,
      surface_color = excluded.surface_color,
      text_color = excluded.text_color,
      danger_color = excluded.danger_color,
      success_color = excluded.success_color,
      logo_url = excluded.logo_url,
      favicon_url = excluded.favicon_url,
      hero_image_url = excluded.hero_image_url,
      layout_density = excluded.layout_density,
      enable_dark_mode = excluded.enable_dark_mode,
      metadata = excluded.metadata,
      updated_at = excluded.updated_at`,
    id,
    ctx.tenantId,
    saasId,
    input.primaryColor,
    input.secondaryColor,
    input.accentColor,
    input.backgroundColor,
    input.surfaceColor,
    input.textColor,
    input.dangerColor,
    input.successColor,
    input.logoUrl ?? null,
    input.faviconUrl ?? null,
    input.heroImageUrl ?? null,
    input.layoutDensity,
    input.enableDarkMode ? 1 : 0,
    serializeMetadata(input.metadata),
    existing?.createdAt ?? now,
    now,
  );

  const saved = await getSaasBrandingSettings(ctx);
  if (!saved) {
    throw new Error("Failed to save branding settings.");
  }
  return saved;
}

export async function getUserUiPreferences(
  ctx: BrandingContext,
  userId: string,
): Promise<SaasUserUiPreferences | null> {
  const saasId = requireSaasId(ctx);
  if (!userId?.trim()) return null;
  if (ctx.mode === "demo") {
    const record = getDemoUserPreferences(ctx.demoTenantId ?? ctx.tenantId, saasId, userId);
    return record ? mapPreferenceRow(record) : null;
  }
  try {
    const rows = await queryAllWithCtx<PreferenceRow>(
      ctx,
      `SELECT * FROM saas_user_ui_preferences WHERE tenant_id = ? AND saas_id = ? AND user_id = ? LIMIT 1`,
      ctx.tenantId,
      saasId,
      userId.trim(),
    );
    return rows[0] ? mapPreferenceRow(rows[0]) : null;
  } catch (error) {
    if (shouldFallbackToDemo(error, ctx)) {
      const record = getDemoUserPreferences(ctx.demoTenantId ?? ctx.tenantId, saasId, userId);
      return record ? mapPreferenceRow(record) : null;
    }
    throw error;
  }
}

export async function upsertUserUiPreferences(
  ctx: BrandingContext,
  userId: string,
  input: Omit<SaasUserUiPreferences, "id" | "tenantId" | "saasId" | "userId" | "createdAt" | "updatedAt">,
): Promise<SaasUserUiPreferences> {
  const saasId = requireSaasId(ctx);
  const now = new Date().toISOString();
  const existing = await getUserUiPreferences(ctx, userId);
  const id = existing?.id ?? `${Date.now()}-${Math.random().toString(16).slice(2)}`;

  if (ctx.mode === "demo") {
    const record = upsertDemoUserPreferences(ctx.demoTenantId ?? ctx.tenantId, {
      id,
      saas_id: saasId,
      user_id: userId,
      role_type: input.roleType,
      layout_density_override: input.layoutDensityOverride ?? null,
      default_section: input.defaultSection ?? null,
      hidden_widgets: serializeHiddenWidgets(input.hiddenWidgets ?? null),
      metadata: serializeMetadata(input.metadata),
    });
    return mapPreferenceRow(record);
  }

  await runWithCtx(
    ctx,
    `INSERT INTO saas_user_ui_preferences (
      id, tenant_id, saas_id, user_id, role_type, layout_density_override, default_section, hidden_widgets,
      metadata, created_at, updated_at
    ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
    ON CONFLICT(tenant_id, saas_id, user_id) DO UPDATE SET
      role_type = excluded.role_type,
      layout_density_override = excluded.layout_density_override,
      default_section = excluded.default_section,
      hidden_widgets = excluded.hidden_widgets,
      metadata = excluded.metadata,
      updated_at = excluded.updated_at`,
    id,
    ctx.tenantId,
    saasId,
    userId,
    input.roleType,
    input.layoutDensityOverride ?? null,
    input.defaultSection ?? null,
    serializeHiddenWidgets(input.hiddenWidgets ?? null),
    serializeMetadata(input.metadata),
    existing?.createdAt ?? now,
    now,
  );

  const saved = await getUserUiPreferences(ctx, userId);
  if (!saved) {
    throw new Error("Failed to save user preferences.");
  }
  return saved;
}

export async function resolveEffectiveTheme(
  ctx: BrandingContext,
  params: { userId?: string | null; roleType?: BrandingRoleType },
): Promise<ResolvedTheme> {
  const branding = await getSaasBrandingSettings(ctx);
  const userId = params.userId?.trim() ?? null;
  const prefs = userId ? await getUserUiPreferences(ctx, userId) : null;

  const merged: ResolvedTheme = {
    colors: {
      primary: branding?.primaryColor ?? DEFAULT_THEME.colors.primary,
      secondary: branding?.secondaryColor ?? DEFAULT_THEME.colors.secondary,
      accent: branding?.accentColor ?? DEFAULT_THEME.colors.accent,
      background: branding?.backgroundColor ?? DEFAULT_THEME.colors.background,
      surface: branding?.surfaceColor ?? DEFAULT_THEME.colors.surface,
      text: branding?.textColor ?? DEFAULT_THEME.colors.text,
      danger: branding?.dangerColor ?? DEFAULT_THEME.colors.danger,
      success: branding?.successColor ?? DEFAULT_THEME.colors.success,
    },
    layoutDensity: prefs?.layoutDensityOverride ?? branding?.layoutDensity ?? DEFAULT_THEME.layoutDensity,
    logoUrl: branding?.logoUrl ?? DEFAULT_THEME.logoUrl,
    heroImageUrl: branding?.heroImageUrl ?? DEFAULT_THEME.heroImageUrl,
    effectiveDarkMode: branding?.enableDarkMode ?? DEFAULT_THEME.effectiveDarkMode,
  };

  if (params.roleType === "EMPLOYEE" && prefs?.layoutDensityOverride) {
    merged.layoutDensity = prefs.layoutDensityOverride;
  }

  return merged;
}
