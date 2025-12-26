import { env as resolveEnv, type DracoEnv } from "@/lib/cf";
import {
  addDemoSaasInventoryMovement,
  getDemoSaasPricingSettings,
  listDemoSaasExpenses,
  listDemoSaasInventoryMovements,
  listDemoSaasInventoryItems,
  listDemoSaasServiceProducts,
  listDemoSaasServices,
  upsertDemoSaasExpense,
  upsertDemoSaasInventoryItem,
  upsertDemoSaasPricingSettings,
  upsertDemoSaasService,
  upsertDemoSaasServiceProduct,
} from "@/lib/admin/demo-data";
import { DEMO_TENANT_ID } from "@/lib/tenants/services";
import type {
  SaasExpense,
  SaasInventoryItem,
  SaasInventoryMovement,
  SaasPricingSettings,
  SaasProfitabilitySnapshot,
  SaasService,
  SaasServiceProduct,
  ServicePhase,
} from "@/lib/economy/types";
import type { SaasCustomerBooking } from "@/lib/customers/types";
import { getOverworkedEmployeeCount } from "@/lib/employees/compliance";
import { resolveEmployeesContext } from "@/lib/employees/context";

export type EconomyContextMode = "d1" | "demo";

export type EconomyContext = {
  tenantId: string;
  saasId: string | null;
  mode: EconomyContextMode;
  allowDemoFallback: boolean;
  demoTenantId?: string;
  db?: D1Database;
};

export class EconomyContextError extends Error {
  constructor(message: string) {
    super(message);
    this.name = "EconomyContextError";
  }
}

const FALLBACK_ERROR_PATTERNS = ["no such table", "no such column"];
const DEFAULT_TARGET_MARGIN = 40;
const DEFAULT_MIN_MARGIN = 25;
const DEFAULT_OCCUPANCY_TARGET = 80;
const DEFAULT_MONTHLY_HOURS = 160;
const DEFAULT_SERVICE_VOLUME = 30;
const DEFAULT_SERVICE_STOCK_THRESHOLD = 2;

function dedupeInventoryItems(items: SaasInventoryItem[]): SaasInventoryItem[] {
  const map = new Map<string, SaasInventoryItem>();
  items.forEach((item) => {
    if (!map.has(item.id)) map.set(item.id, item);
  });
  return Array.from(map.values());
}

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

function shouldFallbackToDemo(error: unknown, ctx: EconomyContext): boolean {
  if (ctx.mode !== "d1" || !ctx.allowDemoFallback) return false;
  const message = (error instanceof Error ? error.message : `${error ?? ""}`).toLowerCase();
  return FALLBACK_ERROR_PATTERNS.some((pattern) => message.includes(pattern));
}

function generateUuid(): string {
  const globalCrypto = typeof globalThis !== "undefined" ? (globalThis.crypto as { randomUUID?: () => string } | undefined) : undefined;
  if (globalCrypto?.randomUUID) {
    try {
      return globalCrypto.randomUUID();
    } catch {
      // ignore and fallback
    }
  }
  return `${Date.now()}-${Math.random().toString(16).slice(2)}`;
}

function demoTenantId(ctx: EconomyContext): string {
  return ctx.demoTenantId ?? ctx.tenantId;
}

function requireSaasId(ctx: EconomyContext): string {
  const saasId = ctx.saasId?.trim();
  if (!saasId) {
    throw new EconomyContextError("saasId is required for economy operations.");
  }
  return saasId;
}

function toSlug(value: string): string {
  return value
    .trim()
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/^-+|-+$/g, "");
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

async function queryAllWithCtx<T>(ctx: EconomyContext, sql: string, ...params: unknown[]): Promise<T[]> {
  if (ctx.mode !== "d1") return [];
  const db = ctx.db ?? resolveEnv()?.DRACO_DB;
  if (!db) return [];
  const stmt = db.prepare(sql);
  const bound = params.length ? stmt.bind(...params) : stmt;
  const res = await bound.all<T>();
  return res.results ?? [];
}

async function runWithCtx(ctx: EconomyContext, sql: string, ...params: unknown[]): Promise<boolean> {
  if (ctx.mode !== "d1") return false;
  const db = ctx.db ?? resolveEnv()?.DRACO_DB;
  if (!db) return false;
  const stmt = db.prepare(sql);
  const bound = params.length ? stmt.bind(...params) : stmt;
  const res = await bound.run();
  return Boolean(res?.success);
}

export async function resolveEconomyContext({
  tenantId,
  saasId,
  env,
}: {
  tenantId: string;
  saasId?: string | null;
  env?: DracoEnv | null;
}): Promise<EconomyContext> {
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
    };
  }

  if (!demoEnabled) {
    throw new EconomyContextError("Economy module is not enabled for this tenant");
  }

  return {
    tenantId,
    saasId: normalizedSaasId,
    mode: "demo",
    allowDemoFallback: true,
    demoTenantId: DEMO_TENANT_ID,
  };
}

type SaasServiceRow = {
  id: string;
  tenant_id: string;
  saas_id: string;
  name: string;
  slug: string;
  category: string | null;
  duration_minutes: number;
  current_price: number;
  recommended_price: number | null;
  is_active: number;
  metadata: string | null;
  created_at: string;
  updated_at: string;
};

type SaasInventoryItemRow = {
  id: string;
  tenant_id: string;
  saas_id: string;
  name: string;
  sku: string | null;
  category: string | null;
  unit: string | null;
  cost_per_unit: number;
  stock_quantity: number;
  min_stock_quantity: number;
  preferred_supplier: string | null;
  metadata: string | null;
  created_at: string;
  updated_at: string;
};

type SaasInventoryMovementRow = {
  id: string;
  tenant_id: string;
  saas_id: string;
  inventory_item_id: string;
  type: string;
  quantity: number;
  reason: string | null;
  source: string | null;
  related_service_id: string | null;
  related_employee_id: string | null;
  created_at: string;
};

type SaasExpenseRow = {
  id: string;
  tenant_id: string;
  saas_id: string;
  type: string;
  label: string;
  amount: number;
  currency: string;
  period: string;
  from_date: string;
  to_date: string | null;
  source: string | null;
  metadata: string | null;
  created_at: string;
  updated_at: string;
};

type SaasPricingSettingsRow = {
  id: string;
  tenant_id: string;
  saas_id: string;
  target_margin_percent: number;
  min_margin_percent: number;
  occupancy_target_percent: number;
  include_payroll: number;
  include_rent: number;
  include_utilities: number;
  include_products: number;
  updated_at: string;
};

type SaasServiceProductRow = {
  id: string;
  tenant_id: string;
  saas_id: string;
  service_id: string;
  inventory_item_id: string;
  quantity_per_service: number;
  metadata: string | null;
};

export type ServiceInventoryStatus = {
  serviceId: string;
  items: Array<{
    inventoryItemId: string;
    name: string;
    quantityPerService: number;
    stockQuantity: number;
    minStockQuantity: number;
    isLowStock: boolean;
  }>;
};

function mapServiceRow(row: SaasServiceRow): SaasService {
  return {
    id: row.id,
    tenantId: row.tenant_id,
    saasId: row.saas_id,
    name: row.name,
    slug: row.slug,
    category: row.category,
    durationMinutes: row.duration_minutes,
    currentPrice: row.current_price,
    recommendedPrice: row.recommended_price,
    isActive: row.is_active === 1,
    metadata: parseMetadata(row.metadata),
    createdAt: row.created_at,
    updatedAt: row.updated_at,
  };
}

function mapInventoryItemRow(row: SaasInventoryItemRow): SaasInventoryItem {
  return {
    id: row.id,
    tenantId: row.tenant_id,
    saasId: row.saas_id,
    name: row.name,
    sku: row.sku,
    category: row.category,
    unit: row.unit,
    costPerUnit: row.cost_per_unit,
    stockQuantity: row.stock_quantity,
    minStockQuantity: row.min_stock_quantity,
    preferredSupplier: row.preferred_supplier,
    metadata: parseMetadata(row.metadata),
    createdAt: row.created_at,
    updatedAt: row.updated_at,
  };
}

function mapExpenseRow(row: SaasExpenseRow): SaasExpense {
  return {
    id: row.id,
    tenantId: row.tenant_id,
    saasId: row.saas_id,
    type: row.type as SaasExpense["type"],
    label: row.label,
    amount: row.amount,
    currency: row.currency,
    period: row.period as SaasExpense["period"],
    fromDate: row.from_date,
    toDate: row.to_date,
    source: row.source as SaasExpense["source"],
    metadata: parseMetadata(row.metadata),
    createdAt: row.created_at,
    updatedAt: row.updated_at,
  };
}

function mapPricingSettingsRow(row: SaasPricingSettingsRow): SaasPricingSettings {
  return {
    id: row.id,
    tenantId: row.tenant_id,
    saasId: row.saas_id,
    targetMarginPercent: row.target_margin_percent,
    minMarginPercent: row.min_margin_percent,
    occupancyTargetPercent: row.occupancy_target_percent,
    includePayroll: row.include_payroll === 1,
    includeRent: row.include_rent === 1,
    includeUtilities: row.include_utilities === 1,
    includeProducts: row.include_products === 1,
    updatedAt: row.updated_at,
  };
}

function mapServiceProductRow(row: SaasServiceProductRow): SaasServiceProduct {
  return {
    id: row.id,
    tenantId: row.tenant_id,
    saasId: row.saas_id,
    serviceId: row.service_id,
    inventoryItemId: row.inventory_item_id,
    quantityPerService: row.quantity_per_service,
    metadata: parseMetadata(row.metadata),
  };
}

function mapInventoryMovementRow(row: SaasInventoryMovementRow): SaasInventoryMovement {
  return {
    id: row.id,
    tenantId: row.tenant_id,
    saasId: row.saas_id,
    inventoryItemId: row.inventory_item_id,
    type: row.type as SaasInventoryMovement["type"],
    quantity: row.quantity,
    reason: row.reason,
    source: row.source as SaasInventoryMovement["source"],
    relatedServiceId: row.related_service_id,
    relatedEmployeeId: row.related_employee_id,
    createdAt: row.created_at,
  };
}

export async function listSaasServices(ctx: EconomyContext): Promise<SaasService[]> {
  const saasId = requireSaasId(ctx);
  if (ctx.mode === "demo") {
    return listDemoSaasServices(demoTenantId(ctx), saasId).map(mapServiceRow);
  }
  try {
    const rows = await queryAllWithCtx<SaasServiceRow>(
      ctx,
      `SELECT id, tenant_id, saas_id, name, slug, category, duration_minutes, current_price, recommended_price, is_active, metadata, created_at, updated_at
       FROM saas_services
       WHERE tenant_id = ? AND saas_id = ?
       ORDER BY name ASC`,
      ctx.tenantId,
      saasId,
    );
    return rows.map(mapServiceRow);
  } catch (error) {
    if (shouldFallbackToDemo(error, ctx)) {
      return listDemoSaasServices(demoTenantId(ctx), saasId).map(mapServiceRow);
    }
    throw error;
  }
}

export async function upsertSaasService(
  ctx: EconomyContext,
  input: {
    id?: string;
    saasId: string;
    name: string;
    slug?: string | null;
    category?: string | null;
    durationMinutes: number;
    currentPrice: number;
    recommendedPrice?: number | null;
    isActive?: boolean;
    metadata?: Record<string, unknown> | null;
  },
): Promise<SaasService> {
  const saasId = input.saasId?.trim() ?? requireSaasId(ctx);
  const now = new Date().toISOString();
  const id = input.id?.trim() ?? generateUuid();
  const slug = input.slug?.trim() || toSlug(input.name);
  if (ctx.mode === "demo") {
    const record = upsertDemoSaasService(demoTenantId(ctx), {
      id,
      saas_id: saasId,
      name: input.name.trim(),
      slug,
      category: input.category ?? null,
      duration_minutes: input.durationMinutes,
      current_price: input.currentPrice,
      recommended_price: input.recommendedPrice ?? null,
      is_active: input.isActive === false ? 0 : 1,
      metadata: serializeMetadata(input.metadata),
    });
    return mapServiceRow(record);
  }
  try {
    await runWithCtx(
      ctx,
      `INSERT INTO saas_services (id, tenant_id, saas_id, name, slug, category, duration_minutes, current_price, recommended_price, is_active, metadata, created_at, updated_at)
       VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
       ON CONFLICT(id) DO UPDATE SET
         name = excluded.name,
         slug = excluded.slug,
         category = excluded.category,
         duration_minutes = excluded.duration_minutes,
         current_price = excluded.current_price,
         recommended_price = excluded.recommended_price,
         is_active = excluded.is_active,
         metadata = excluded.metadata,
         updated_at = excluded.updated_at`,
      id,
      ctx.tenantId,
      saasId,
      input.name.trim(),
      slug,
      input.category ?? null,
      input.durationMinutes,
      input.currentPrice,
      input.recommendedPrice ?? null,
      input.isActive === false ? 0 : 1,
      serializeMetadata(input.metadata),
      now,
      now,
    );
    const rows = await queryAllWithCtx<SaasServiceRow>(
      ctx,
      `SELECT id, tenant_id, saas_id, name, slug, category, duration_minutes, current_price, recommended_price, is_active, metadata, created_at, updated_at
       FROM saas_services
       WHERE id = ?
       LIMIT 1`,
      id,
    );
    return mapServiceRow(rows[0]);
  } catch (error) {
    if (shouldFallbackToDemo(error, ctx)) {
      const record = upsertDemoSaasService(demoTenantId(ctx), {
        id,
        saas_id: saasId,
        name: input.name.trim(),
        slug,
        category: input.category ?? null,
        duration_minutes: input.durationMinutes,
        current_price: input.currentPrice,
        recommended_price: input.recommendedPrice ?? null,
        is_active: input.isActive === false ? 0 : 1,
        metadata: serializeMetadata(input.metadata),
      });
      return mapServiceRow(record);
    }
    throw error;
  }
}

export async function listSaasInventoryItems(ctx: EconomyContext): Promise<SaasInventoryItem[]> {
  const saasId = requireSaasId(ctx);
  if (ctx.mode === "demo") {
    return listDemoSaasInventoryItems(demoTenantId(ctx), saasId).map(mapInventoryItemRow);
  }
  try {
    const rows = await queryAllWithCtx<SaasInventoryItemRow>(
      ctx,
      `SELECT id, tenant_id, saas_id, name, sku, category, unit, cost_per_unit, stock_quantity, min_stock_quantity, preferred_supplier, metadata, created_at, updated_at
       FROM saas_inventory_items
       WHERE tenant_id = ? AND saas_id = ?
       ORDER BY name ASC`,
      ctx.tenantId,
      saasId,
    );
    return rows.map(mapInventoryItemRow);
  } catch (error) {
    if (shouldFallbackToDemo(error, ctx)) {
      return listDemoSaasInventoryItems(demoTenantId(ctx), saasId).map(mapInventoryItemRow);
    }
    throw error;
  }
}

export async function getLowStockItems(ctx: EconomyContext): Promise<SaasInventoryItem[]> {
  const items = dedupeInventoryItems(await listSaasInventoryItems(ctx));
  return items.filter((item) => item.stockQuantity < item.minStockQuantity);
}

export async function upsertSaasInventoryItem(
  ctx: EconomyContext,
  input: {
    id?: string;
    saasId: string;
    name: string;
    sku?: string | null;
    category?: string | null;
    unit?: string | null;
    costPerUnit: number;
    stockQuantity?: number;
    minStockQuantity?: number;
    preferredSupplier?: string | null;
    metadata?: Record<string, unknown> | null;
  },
): Promise<SaasInventoryItem> {
  const saasId = input.saasId?.trim() ?? requireSaasId(ctx);
  const now = new Date().toISOString();
  const id = input.id?.trim() ?? generateUuid();
  if (ctx.mode === "demo") {
    const record = upsertDemoSaasInventoryItem(demoTenantId(ctx), {
      id,
      saas_id: saasId,
      name: input.name.trim(),
      sku: input.sku ?? null,
      category: input.category ?? null,
      unit: input.unit ?? null,
      cost_per_unit: input.costPerUnit,
      stock_quantity: input.stockQuantity ?? 0,
      min_stock_quantity: input.minStockQuantity ?? 0,
      preferred_supplier: input.preferredSupplier ?? null,
      metadata: serializeMetadata(input.metadata),
    });
    return mapInventoryItemRow(record);
  }
  try {
    await runWithCtx(
      ctx,
      `INSERT INTO saas_inventory_items (id, tenant_id, saas_id, name, sku, category, unit, cost_per_unit, stock_quantity, min_stock_quantity, preferred_supplier, metadata, created_at, updated_at)
       VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
       ON CONFLICT(id) DO UPDATE SET
         name = excluded.name,
         sku = excluded.sku,
         category = excluded.category,
         unit = excluded.unit,
         cost_per_unit = excluded.cost_per_unit,
         stock_quantity = excluded.stock_quantity,
         min_stock_quantity = excluded.min_stock_quantity,
         preferred_supplier = excluded.preferred_supplier,
         metadata = excluded.metadata,
         updated_at = excluded.updated_at`,
      id,
      ctx.tenantId,
      saasId,
      input.name.trim(),
      input.sku ?? null,
      input.category ?? null,
      input.unit ?? null,
      input.costPerUnit,
      input.stockQuantity ?? 0,
      input.minStockQuantity ?? 0,
      input.preferredSupplier ?? null,
      serializeMetadata(input.metadata),
      now,
      now,
    );
    const rows = await queryAllWithCtx<SaasInventoryItemRow>(
      ctx,
      `SELECT id, tenant_id, saas_id, name, sku, category, unit, cost_per_unit, stock_quantity, min_stock_quantity, preferred_supplier, metadata, created_at, updated_at
       FROM saas_inventory_items
       WHERE id = ?
       LIMIT 1`,
      id,
    );
    return mapInventoryItemRow(rows[0]);
  } catch (error) {
    if (shouldFallbackToDemo(error, ctx)) {
      const record = upsertDemoSaasInventoryItem(demoTenantId(ctx), {
        id,
        saas_id: saasId,
        name: input.name.trim(),
        sku: input.sku ?? null,
        category: input.category ?? null,
        unit: input.unit ?? null,
        cost_per_unit: input.costPerUnit,
        stock_quantity: input.stockQuantity ?? 0,
        min_stock_quantity: input.minStockQuantity ?? 0,
        preferred_supplier: input.preferredSupplier ?? null,
        metadata: serializeMetadata(input.metadata),
      });
      return mapInventoryItemRow(record);
    }
    throw error;
  }
}

export async function recordInventoryMovement(
  ctx: EconomyContext,
  input: {
    saasId: string;
    inventoryItemId: string;
    type: SaasInventoryMovement["type"];
    quantity: number;
    reason?: string | null;
    source?: SaasInventoryMovement["source"] | null;
    relatedServiceId?: string | null;
    relatedEmployeeId?: string | null;
    createdAt?: string;
  },
): Promise<SaasInventoryMovement> {
  const saasId = input.saasId?.trim() ?? requireSaasId(ctx);
  const now = input.createdAt ?? new Date().toISOString();
  const id = generateUuid();
  const delta = input.type === "OUT" ? -Math.abs(input.quantity) : input.type === "IN" ? Math.abs(input.quantity) : input.quantity;
  if (ctx.mode === "demo") {
    const movement = addDemoSaasInventoryMovement(demoTenantId(ctx), {
      id,
      saas_id: saasId,
      inventory_item_id: input.inventoryItemId,
      type: input.type,
      quantity: input.quantity,
      reason: input.reason ?? null,
      source: input.source ?? null,
      related_service_id: input.relatedServiceId ?? null,
      related_employee_id: input.relatedEmployeeId ?? null,
      created_at: now,
    });
    const items = listDemoSaasInventoryItems(demoTenantId(ctx), saasId);
    const item = items.find((entry) => entry.id === input.inventoryItemId);
    if (item) {
      upsertDemoSaasInventoryItem(demoTenantId(ctx), {
        ...item,
        stock_quantity: (item.stock_quantity ?? 0) + delta,
      });
    }
    return mapInventoryMovementRow(movement);
  }
  try {
    await runWithCtx(
      ctx,
      `INSERT INTO saas_inventory_movements (id, tenant_id, saas_id, inventory_item_id, type, quantity, reason, source, related_service_id, related_employee_id, created_at)
       VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`,
      id,
      ctx.tenantId,
      saasId,
      input.inventoryItemId,
      input.type,
      input.quantity,
      input.reason ?? null,
      input.source ?? null,
      input.relatedServiceId ?? null,
      input.relatedEmployeeId ?? null,
      now,
    );
    await runWithCtx(
      ctx,
      `UPDATE saas_inventory_items
       SET stock_quantity = stock_quantity + ?, updated_at = ?
       WHERE tenant_id = ? AND saas_id = ? AND id = ?`,
      delta,
      now,
      ctx.tenantId,
      saasId,
      input.inventoryItemId,
    );
    const rows = await queryAllWithCtx<SaasInventoryMovementRow>(
      ctx,
      `SELECT id, tenant_id, saas_id, inventory_item_id, type, quantity, reason, source, related_service_id, related_employee_id, created_at
       FROM saas_inventory_movements
       WHERE id = ?
       LIMIT 1`,
      id,
    );
    return mapInventoryMovementRow(rows[0]);
  } catch (error) {
    if (shouldFallbackToDemo(error, ctx)) {
      const movement = addDemoSaasInventoryMovement(demoTenantId(ctx), {
        id,
        saas_id: saasId,
        inventory_item_id: input.inventoryItemId,
        type: input.type,
        quantity: input.quantity,
        reason: input.reason ?? null,
        source: input.source ?? null,
        related_service_id: input.relatedServiceId ?? null,
        related_employee_id: input.relatedEmployeeId ?? null,
        created_at: now,
      });
      return mapInventoryMovementRow(movement);
    }
    throw error;
  }
}

export async function listSaasExpenses(ctx: EconomyContext): Promise<SaasExpense[]> {
  const saasId = requireSaasId(ctx);
  if (ctx.mode === "demo") {
    return listDemoSaasExpenses(demoTenantId(ctx), saasId).map(mapExpenseRow);
  }
  try {
    const rows = await queryAllWithCtx<SaasExpenseRow>(
      ctx,
      `SELECT id, tenant_id, saas_id, type, label, amount, currency, period, from_date, to_date, source, metadata, created_at, updated_at
       FROM saas_expenses
       WHERE tenant_id = ? AND saas_id = ?
       ORDER BY datetime(from_date) DESC`,
      ctx.tenantId,
      saasId,
    );
    return rows.map(mapExpenseRow);
  } catch (error) {
    if (shouldFallbackToDemo(error, ctx)) {
      return listDemoSaasExpenses(demoTenantId(ctx), saasId).map(mapExpenseRow);
    }
    throw error;
  }
}

export async function upsertSaasExpense(
  ctx: EconomyContext,
  input: {
    id?: string;
    saasId: string;
    type: SaasExpense["type"];
    label: string;
    amount: number;
    currency: string;
    period: SaasExpense["period"];
    fromDate: string;
    toDate?: string | null;
    source?: SaasExpense["source"] | null;
    metadata?: Record<string, unknown> | null;
  },
): Promise<SaasExpense> {
  const saasId = input.saasId?.trim() ?? requireSaasId(ctx);
  const now = new Date().toISOString();
  const id = input.id?.trim() ?? generateUuid();
  if (ctx.mode === "demo") {
    const record = upsertDemoSaasExpense(demoTenantId(ctx), {
      id,
      saas_id: saasId,
      type: input.type,
      label: input.label.trim(),
      amount: input.amount,
      currency: input.currency ?? "EUR",
      period: input.period,
      from_date: input.fromDate,
      to_date: typeof input.toDate === "undefined" ? null : input.toDate,
      source: input.source ?? null,
      metadata: serializeMetadata(input.metadata),
    });
    return mapExpenseRow(record);
  }
  try {
    await runWithCtx(
      ctx,
      `INSERT INTO saas_expenses (id, tenant_id, saas_id, type, label, amount, currency, period, from_date, to_date, source, metadata, created_at, updated_at)
       VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
       ON CONFLICT(id) DO UPDATE SET
         type = excluded.type,
         label = excluded.label,
         amount = excluded.amount,
         currency = excluded.currency,
         period = excluded.period,
         from_date = excluded.from_date,
         to_date = excluded.to_date,
         source = excluded.source,
         metadata = excluded.metadata,
         updated_at = excluded.updated_at`,
      id,
      ctx.tenantId,
      saasId,
      input.type,
      input.label.trim(),
      input.amount,
      input.currency ?? "EUR",
      input.period,
      input.fromDate,
      typeof input.toDate === "undefined" ? null : input.toDate,
      input.source ?? null,
      serializeMetadata(input.metadata),
      now,
      now,
    );
    const rows = await queryAllWithCtx<SaasExpenseRow>(
      ctx,
      `SELECT id, tenant_id, saas_id, type, label, amount, currency, period, from_date, to_date, source, metadata, created_at, updated_at
       FROM saas_expenses
       WHERE id = ?
       LIMIT 1`,
      id,
    );
    return mapExpenseRow(rows[0]);
  } catch (error) {
    if (shouldFallbackToDemo(error, ctx)) {
      const record = upsertDemoSaasExpense(demoTenantId(ctx), {
        id,
        saas_id: saasId,
        type: input.type,
        label: input.label.trim(),
        amount: input.amount,
        currency: input.currency ?? "EUR",
        period: input.period,
        from_date: input.fromDate,
        to_date: typeof input.toDate === "undefined" ? null : input.toDate,
        source: input.source ?? null,
        metadata: serializeMetadata(input.metadata),
      });
      return mapExpenseRow(record);
    }
    throw error;
  }
}

export async function getSaasPricingSettings(ctx: EconomyContext): Promise<SaasPricingSettings> {
  const saasId = requireSaasId(ctx);
  if (ctx.mode === "demo") {
    const record = getDemoSaasPricingSettings(demoTenantId(ctx), saasId);
    if (record) {
      return mapPricingSettingsRow(record);
    }
    return {
      id: "pricing_default",
      tenantId: ctx.tenantId,
      saasId,
      targetMarginPercent: DEFAULT_TARGET_MARGIN,
      minMarginPercent: DEFAULT_MIN_MARGIN,
      occupancyTargetPercent: DEFAULT_OCCUPANCY_TARGET,
      includePayroll: true,
      includeRent: true,
      includeUtilities: true,
      includeProducts: true,
      updatedAt: new Date().toISOString(),
    };
  }
  try {
    const rows = await queryAllWithCtx<SaasPricingSettingsRow>(
      ctx,
      `SELECT id, tenant_id, saas_id, target_margin_percent, min_margin_percent, occupancy_target_percent, include_payroll, include_rent, include_utilities, include_products, updated_at
       FROM saas_pricing_settings
       WHERE tenant_id = ? AND saas_id = ?
       LIMIT 1`,
      ctx.tenantId,
      saasId,
    );
    if (rows[0]) return mapPricingSettingsRow(rows[0]);
    return {
      id: "pricing_default",
      tenantId: ctx.tenantId,
      saasId,
      targetMarginPercent: DEFAULT_TARGET_MARGIN,
      minMarginPercent: DEFAULT_MIN_MARGIN,
      occupancyTargetPercent: DEFAULT_OCCUPANCY_TARGET,
      includePayroll: true,
      includeRent: true,
      includeUtilities: true,
      includeProducts: true,
      updatedAt: new Date().toISOString(),
    };
  } catch (error) {
    if (shouldFallbackToDemo(error, ctx)) {
      const record = getDemoSaasPricingSettings(demoTenantId(ctx), saasId);
      if (record) return mapPricingSettingsRow(record);
      return {
        id: "pricing_default",
        tenantId: ctx.tenantId,
        saasId,
        targetMarginPercent: DEFAULT_TARGET_MARGIN,
        minMarginPercent: DEFAULT_MIN_MARGIN,
        occupancyTargetPercent: DEFAULT_OCCUPANCY_TARGET,
        includePayroll: true,
        includeRent: true,
        includeUtilities: true,
        includeProducts: true,
        updatedAt: new Date().toISOString(),
      };
    }
    throw error;
  }
}

export async function upsertSaasPricingSettings(
  ctx: EconomyContext,
  input: {
    id?: string;
    saasId: string;
    targetMarginPercent: number;
    minMarginPercent: number;
    occupancyTargetPercent: number;
    includePayroll: boolean;
    includeRent: boolean;
    includeUtilities: boolean;
    includeProducts: boolean;
  },
): Promise<SaasPricingSettings> {
  const saasId = input.saasId?.trim() ?? requireSaasId(ctx);
  const now = new Date().toISOString();
  const id = input.id?.trim() ?? generateUuid();
  if (ctx.mode === "demo") {
    const record = upsertDemoSaasPricingSettings(demoTenantId(ctx), {
      id,
      saas_id: saasId,
      target_margin_percent: input.targetMarginPercent,
      min_margin_percent: input.minMarginPercent,
      occupancy_target_percent: input.occupancyTargetPercent,
      include_payroll: input.includePayroll ? 1 : 0,
      include_rent: input.includeRent ? 1 : 0,
      include_utilities: input.includeUtilities ? 1 : 0,
      include_products: input.includeProducts ? 1 : 0,
    });
    return mapPricingSettingsRow(record);
  }
  try {
    await runWithCtx(
      ctx,
      `INSERT INTO saas_pricing_settings (id, tenant_id, saas_id, target_margin_percent, min_margin_percent, occupancy_target_percent, include_payroll, include_rent, include_utilities, include_products, updated_at)
       VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
       ON CONFLICT(tenant_id, saas_id) DO UPDATE SET
         target_margin_percent = excluded.target_margin_percent,
         min_margin_percent = excluded.min_margin_percent,
         occupancy_target_percent = excluded.occupancy_target_percent,
         include_payroll = excluded.include_payroll,
         include_rent = excluded.include_rent,
         include_utilities = excluded.include_utilities,
         include_products = excluded.include_products,
         updated_at = excluded.updated_at`,
      id,
      ctx.tenantId,
      saasId,
      input.targetMarginPercent,
      input.minMarginPercent,
      input.occupancyTargetPercent,
      input.includePayroll ? 1 : 0,
      input.includeRent ? 1 : 0,
      input.includeUtilities ? 1 : 0,
      input.includeProducts ? 1 : 0,
      now,
    );
    const rows = await queryAllWithCtx<SaasPricingSettingsRow>(
      ctx,
      `SELECT id, tenant_id, saas_id, target_margin_percent, min_margin_percent, occupancy_target_percent, include_payroll, include_rent, include_utilities, include_products, updated_at
       FROM saas_pricing_settings
       WHERE tenant_id = ? AND saas_id = ?
       LIMIT 1`,
      ctx.tenantId,
      saasId,
    );
    return mapPricingSettingsRow(rows[0]);
  } catch (error) {
    if (shouldFallbackToDemo(error, ctx)) {
      const record = upsertDemoSaasPricingSettings(demoTenantId(ctx), {
        id,
        saas_id: saasId,
        target_margin_percent: input.targetMarginPercent,
        min_margin_percent: input.minMarginPercent,
        occupancy_target_percent: input.occupancyTargetPercent,
        include_payroll: input.includePayroll ? 1 : 0,
        include_rent: input.includeRent ? 1 : 0,
        include_utilities: input.includeUtilities ? 1 : 0,
        include_products: input.includeProducts ? 1 : 0,
      });
      return mapPricingSettingsRow(record);
    }
    throw error;
  }
}

export async function listSaasServiceProducts(ctx: EconomyContext, serviceId: string): Promise<SaasServiceProduct[]> {
  const saasId = requireSaasId(ctx);
  if (ctx.mode === "demo") {
    return listDemoSaasServiceProducts(demoTenantId(ctx), saasId, serviceId).map(mapServiceProductRow);
  }
  try {
    const rows = await queryAllWithCtx<SaasServiceProductRow>(
      ctx,
      `SELECT id, tenant_id, saas_id, service_id, inventory_item_id, quantity_per_service, metadata
       FROM saas_service_products
       WHERE tenant_id = ? AND saas_id = ? AND service_id = ?
       ORDER BY id ASC`,
      ctx.tenantId,
      saasId,
      serviceId,
    );
    return rows.map(mapServiceProductRow);
  } catch (error) {
    if (shouldFallbackToDemo(error, ctx)) {
      return listDemoSaasServiceProducts(demoTenantId(ctx), saasId, serviceId).map(mapServiceProductRow);
    }
    throw error;
  }
}

export function getServicePhases(service: SaasService): ServicePhase[] {
  const metadata = service.metadata ?? {};
  const raw = (metadata as { phases?: unknown }).phases;
  if (!Array.isArray(raw)) return [];
  return raw
    .map((phase) => {
      if (!phase || typeof phase !== "object") return null;
      const data = phase as Record<string, unknown>;
      const id = typeof data.id === "string" ? data.id : "";
      const label = typeof data.label === "string" ? data.label : "";
      const phaseType = typeof data.phaseType === "string" ? data.phaseType : "OTHER";
      const durationMinutes = typeof data.durationMinutes === "number" ? data.durationMinutes : Number(data.durationMinutes);
      if (!id || !label || !Number.isFinite(durationMinutes)) return null;
      return { id, label, phaseType, durationMinutes };
    })
    .filter((phase): phase is ServicePhase => Boolean(phase));
}

export async function getServiceInventoryStatus(
  ctx: EconomyContext,
  serviceId: string,
  threshold = DEFAULT_SERVICE_STOCK_THRESHOLD,
): Promise<ServiceInventoryStatus> {
  const [products, inventoryItems] = await Promise.all([listSaasServiceProducts(ctx, serviceId), listSaasInventoryItems(ctx)]);
  const inventoryMap = new Map(dedupeInventoryItems(inventoryItems).map((item) => [item.id, item]));
  const items = products.map((product) => {
    const item = inventoryMap.get(product.inventoryItemId);
    const stockQuantity = item?.stockQuantity ?? 0;
    const minStockQuantity = item?.minStockQuantity ?? 0;
    const thresholdLimit = product.quantityPerService > 0 ? product.quantityPerService * threshold : 0;
    const lowByUsage = thresholdLimit > 0 && stockQuantity < thresholdLimit;
    const isLowStock = stockQuantity < minStockQuantity || lowByUsage;
    return {
      inventoryItemId: product.inventoryItemId,
      name: item?.name ?? product.inventoryItemId,
      quantityPerService: product.quantityPerService,
      stockQuantity,
      minStockQuantity,
      isLowStock,
    };
  });
  return { serviceId, items };
}

export async function consumeInventoryForBooking(
  ctx: EconomyContext,
  booking: SaasCustomerBooking,
): Promise<{ movements: SaasInventoryMovement[]; reason?: string }> {
  const saasId = requireSaasId(ctx);
  const products = await listSaasServiceProducts(ctx, booking.serviceId);
  if (products.length === 0) {
    return { movements: [], reason: "SERVICE_USAGE_MISSING_MAPPING" };
  }
  const movements = await Promise.all(
    products.map((product) =>
      recordInventoryMovement(ctx, {
        saasId,
        inventoryItemId: product.inventoryItemId,
        type: "OUT",
        quantity: product.quantityPerService,
        reason: "SERVICE_USAGE",
        source: "SERVICE_USAGE",
        relatedServiceId: booking.serviceId,
        relatedEmployeeId: booking.employeeId ?? null,
      }),
    ),
  );
  return { movements };
}

export async function upsertSaasServiceProduct(
  ctx: EconomyContext,
  input: {
    id?: string;
    saasId: string;
    serviceId: string;
    inventoryItemId: string;
    quantityPerService: number;
    metadata?: Record<string, unknown> | null;
  },
): Promise<SaasServiceProduct> {
  const saasId = input.saasId?.trim() ?? requireSaasId(ctx);
  const id = input.id?.trim() ?? generateUuid();
  if (ctx.mode === "demo") {
    const record = upsertDemoSaasServiceProduct(demoTenantId(ctx), {
      id,
      saas_id: saasId,
      service_id: input.serviceId,
      inventory_item_id: input.inventoryItemId,
      quantity_per_service: input.quantityPerService,
      metadata: serializeMetadata(input.metadata),
    });
    return mapServiceProductRow(record);
  }
  try {
    await runWithCtx(
      ctx,
      `INSERT INTO saas_service_products (id, tenant_id, saas_id, service_id, inventory_item_id, quantity_per_service, metadata)
       VALUES (?, ?, ?, ?, ?, ?, ?)
       ON CONFLICT(id) DO UPDATE SET
         service_id = excluded.service_id,
         inventory_item_id = excluded.inventory_item_id,
         quantity_per_service = excluded.quantity_per_service,
         metadata = excluded.metadata`,
      id,
      ctx.tenantId,
      saasId,
      input.serviceId,
      input.inventoryItemId,
      input.quantityPerService,
      serializeMetadata(input.metadata),
    );
    const rows = await queryAllWithCtx<SaasServiceProductRow>(
      ctx,
      `SELECT id, tenant_id, saas_id, service_id, inventory_item_id, quantity_per_service, metadata
       FROM saas_service_products
       WHERE id = ?
       LIMIT 1`,
      id,
    );
    return mapServiceProductRow(rows[0]);
  } catch (error) {
    if (shouldFallbackToDemo(error, ctx)) {
      const record = upsertDemoSaasServiceProduct(demoTenantId(ctx), {
        id,
        saas_id: saasId,
        service_id: input.serviceId,
        inventory_item_id: input.inventoryItemId,
        quantity_per_service: input.quantityPerService,
        metadata: serializeMetadata(input.metadata),
      });
      return mapServiceProductRow(record);
    }
    throw error;
  }
}

function monthlyAmount(expense: SaasExpense): number {
  if (expense.period === "YEARLY") return expense.amount / 12;
  if (expense.period === "ONE_OFF") return expense.amount;
  return expense.amount;
}

export async function calculateServiceCost(
  ctx: EconomyContext,
  serviceId: string,
): Promise<{ totalCost: number; productCost: number; overheadCost: number }> {
  const serviceList = await listSaasServices(ctx);
  const service = serviceList.find((item) => item.id === serviceId);
  if (!service) {
    throw new EconomyContextError("Service not found for cost calculation.");
  }
  const [serviceProducts, inventoryItems, settings, expenses] = await Promise.all([
    listSaasServiceProducts(ctx, serviceId),
    listSaasInventoryItems(ctx),
    getSaasPricingSettings(ctx),
    listSaasExpenses(ctx),
  ]);
  const inventoryMap = new Map(inventoryItems.map((item) => [item.id, item]));
  const productCost = serviceProducts.reduce((acc, product) => {
    const item = inventoryMap.get(product.inventoryItemId);
    if (!item) return acc;
    return acc + product.quantityPerService * item.costPerUnit;
  }, 0);

  const includeRent = settings.includeRent;
  const includeUtilities = settings.includeUtilities;
  const includePayroll = settings.includePayroll;
  const includeProducts = settings.includeProducts;

  const monthlyOverhead = expenses.reduce((acc, expense) => {
    if (expense.type === "RENT" && includeRent) return acc + monthlyAmount(expense);
    if (expense.type === "UTILITIES" && includeUtilities) return acc + monthlyAmount(expense);
    // TODO: replace with real payroll costs once Employees/HR exposes aggregated payroll data.
    if (expense.type === "PAYROLL" && includePayroll) return acc + monthlyAmount(expense);
    return acc;
  }, 0);

  const effectiveMonthlyHours = Math.max(1, (DEFAULT_MONTHLY_HOURS * settings.occupancyTargetPercent) / 100);
  const overheadPerHour = monthlyOverhead / effectiveMonthlyHours;
  const overheadCost = overheadPerHour * (service.durationMinutes / 60);
  const totalCost = (includeProducts ? productCost : 0) + overheadCost;

  return {
    totalCost,
    productCost: includeProducts ? productCost : 0,
    overheadCost,
  };
}

export async function calculateServiceMargin(ctx: EconomyContext, serviceId: string): Promise<number> {
  const serviceList = await listSaasServices(ctx);
  const service = serviceList.find((item) => item.id === serviceId);
  if (!service) {
    throw new EconomyContextError("Service not found for margin calculation.");
  }
  const cost = await calculateServiceCost(ctx, serviceId);
  if (service.currentPrice <= 0) return -100;
  return ((service.currentPrice - cost.totalCost) / service.currentPrice) * 100;
}

function estimateMonthlyRevenue(services: SaasService[], volume = DEFAULT_SERVICE_VOLUME): number {
  return services.reduce((acc, service) => acc + service.currentPrice * volume, 0);
}

export async function getSaasProfitabilitySnapshot(ctx: EconomyContext): Promise<SaasProfitabilitySnapshot> {
  requireSaasId(ctx);
  const [services, expenses, settings] = await Promise.all([
    listSaasServices(ctx),
    listSaasExpenses(ctx),
    getSaasPricingSettings(ctx),
  ]);

  const activeServices = services.filter((service) => service.isActive);
  const revenue = estimateMonthlyRevenue(activeServices, DEFAULT_SERVICE_VOLUME);

  const rentCosts = expenses.filter((expense) => expense.type === "RENT").reduce((acc, expense) => acc + monthlyAmount(expense), 0);
  const utilitiesCosts = expenses
    .filter((expense) => expense.type === "UTILITIES")
    .reduce((acc, expense) => acc + monthlyAmount(expense), 0);
  const payrollCosts = expenses.filter((expense) => expense.type === "PAYROLL").reduce((acc, expense) => acc + monthlyAmount(expense), 0);
  const otherCosts = expenses
    .filter((expense) => !["RENT", "UTILITIES", "PAYROLL"].includes(expense.type))
    .reduce((acc, expense) => acc + monthlyAmount(expense), 0);

  const productCosts = settings.includeProducts
    ? (await Promise.all(activeServices.map((service) => calculateServiceCost(ctx, service.id)))).reduce(
        (acc, cost) => acc + cost.productCost * DEFAULT_SERVICE_VOLUME,
        0,
      )
    : 0;

  const totalCosts = rentCosts + utilitiesCosts + payrollCosts + otherCosts + productCosts;
  const marginPercent = revenue > 0 ? ((revenue - totalCosts) / revenue) * 100 : 0;

  let overworkedCount = 0;
  try {
    const employeesCtx = await resolveEmployeesContext(ctx.tenantId, requireSaasId(ctx));
    overworkedCount = await getOverworkedEmployeeCount(employeesCtx, requireSaasId(ctx));
  } catch (error) {
    console.warn("ECONOMY_OVERWORKED_COUNT_FALLBACK", error);
  }

  let canHireAdvice = "Revisa los costes antes de ampliar el equipo.";
  if (marginPercent >= settings.targetMarginPercent && overworkedCount === 0) {
    canHireAdvice = "La economía está sana; puedes plantearte contratar un refuerzo si la demanda lo justifica.";
  } else if (marginPercent < settings.minMarginPercent || overworkedCount >= 2) {
    canHireAdvice = "No es recomendable contratar más; primero ajusta precios y carga de trabajo.";
  } else if (overworkedCount > 0) {
    canHireAdvice = "Hay señales de sobrecarga; prioriza equilibrio de turnos antes de sumar plantilla.";
  } else {
    canHireAdvice = "Puedes mejorar margen antes de contratar para asegurar rentabilidad.";
  }

  return {
    totalRevenue: revenue,
    totalCosts,
    productCosts,
    rentCosts,
    utilitiesCosts,
    payrollCosts,
    marginPercent,
    targetMarginPercent: settings.targetMarginPercent,
    estimatedMonthlyRevenue: revenue,
    estimatedMonthlyCosts: totalCosts,
    canHireAdvice: `Con los precios actuales estás en ${marginPercent.toFixed(0)}% de margen estimado. Objetivo: ${settings.targetMarginPercent.toFixed(0)}%. ${canHireAdvice}`,
  };
}

export async function listSaasInventoryMovements(ctx: EconomyContext, inventoryItemId: string): Promise<SaasInventoryMovement[]> {
  const saasId = requireSaasId(ctx);
  if (ctx.mode === "demo") {
    return listDemoSaasInventoryMovements(demoTenantId(ctx), saasId, inventoryItemId).map(mapInventoryMovementRow);
  }
  const rows = await queryAllWithCtx<SaasInventoryMovementRow>(
    ctx,
    `SELECT id, tenant_id, saas_id, inventory_item_id, type, quantity, reason, source, related_service_id, related_employee_id, created_at
     FROM saas_inventory_movements
     WHERE tenant_id = ? AND saas_id = ? AND inventory_item_id = ?
     ORDER BY datetime(created_at) DESC`,
    ctx.tenantId,
    saasId,
    inventoryItemId,
  );
  return rows.map(mapInventoryMovementRow);
}

export async function estimateMonthlyUsageForItem(ctx: EconomyContext, inventoryItemId: string): Promise<number> {
  const saasId = requireSaasId(ctx);
  const windowDays = 90;
  const cutoff = Date.now() - windowDays * 24 * 60 * 60 * 1000;
  const movements = await listSaasInventoryMovements(ctx, inventoryItemId);
  const totalOut = movements
    .filter((movement) => movement.type === "OUT" && new Date(movement.createdAt).getTime() >= cutoff)
    .reduce((acc, movement) => acc + Math.abs(movement.quantity), 0);
  if (totalOut > 0) {
    const usagePerDay = totalOut / windowDays;
    return usagePerDay * 30;
  }

  if (ctx.mode === "demo") {
    const products = listDemoSaasServiceProducts(demoTenantId(ctx), saasId)
      .filter((item) => item.inventory_item_id === inventoryItemId);
    if (products.length === 0) return 0;
    return products.reduce((acc, item) => acc + item.quantity_per_service * DEFAULT_SERVICE_VOLUME, 0);
  }

  const rows = await queryAllWithCtx<SaasServiceProductRow>(
    ctx,
    `SELECT id, tenant_id, saas_id, service_id, inventory_item_id, quantity_per_service, metadata
     FROM saas_service_products
     WHERE tenant_id = ? AND saas_id = ? AND inventory_item_id = ?`,
    ctx.tenantId,
    saasId,
    inventoryItemId,
  );
  if (rows.length === 0) return 0;
  return rows.reduce((acc, row) => acc + row.quantity_per_service * DEFAULT_SERVICE_VOLUME, 0);
}
