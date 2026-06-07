import { beforeEach, describe, expect, it, vi } from "vitest";
import { readFileSync } from "node:fs";

const {
  registrations,
  registerAutomation,
  getAutomation,
  listAutomations,
  enableAutomation,
  disableAutomation,
  AutomationCoreError,
} = vi.hoisted(() => {
  type Registration = {
    id: string;
    tenantId: string;
    saasId: string;
    automationKey: string;
    displayName: string;
    description: string | null;
    enabled: boolean;
    scheduleMode: "manual" | "scheduled";
    frequencyUnit: "hour" | "day" | "week" | null;
    frequencyValue: number | null;
    config: Record<string, unknown> | null;
    ownerScope: "OWNER";
    createdAt: string;
    updatedAt: string;
  };

  class HoistedAutomationCoreError extends Error {
    code: string;

    constructor(code: string, message?: string) {
      super(message ?? code);
      this.name = "AutomationCoreError";
      this.code = code;
    }
  }

  const rows: Registration[] = [];

  function findRegistration(tenantId: string, saasId: string, automationKey: string) {
    return rows.find(
      (item) => item.tenantId === tenantId && item.saasId === saasId && item.automationKey === automationKey,
    ) ?? null;
  }

  return {
    registrations: rows,
    AutomationCoreError: HoistedAutomationCoreError,
    getAutomation: vi.fn(async (tenantId: string, saasId: string, automationKey: string) =>
      findRegistration(tenantId, saasId, automationKey),
    ),
    registerAutomation: vi.fn(async (input: {
      tenantId: string;
      saasId: string;
      automationKey: string;
      displayName: string;
      description?: string | null;
      enabled?: boolean;
      scheduleMode?: "manual" | "scheduled";
      frequencyUnit?: "hour" | "day" | "week" | null;
      frequencyValue?: number | null;
      config?: Record<string, unknown> | null;
      ownerScope?: "OWNER";
    }) => {
      const existing = findRegistration(input.tenantId, input.saasId, input.automationKey);
      const now = new Date().toISOString();

      if (existing) {
        existing.displayName = input.displayName;
        existing.description = input.description ?? null;
        existing.enabled = input.enabled ?? existing.enabled;
        existing.scheduleMode = input.scheduleMode ?? existing.scheduleMode;
        existing.frequencyUnit = typeof input.frequencyUnit === "undefined" ? existing.frequencyUnit : input.frequencyUnit;
        existing.frequencyValue = typeof input.frequencyValue === "undefined" ? existing.frequencyValue : input.frequencyValue;
        existing.config = typeof input.config === "undefined" ? existing.config : input.config;
        existing.ownerScope = input.ownerScope ?? existing.ownerScope;
        existing.updatedAt = now;
        return existing;
      }

      const created = {
        id: `automation-${rows.length + 1}`,
        tenantId: input.tenantId,
        saasId: input.saasId,
        automationKey: input.automationKey,
        displayName: input.displayName,
        description: input.description ?? null,
        enabled: input.enabled ?? true,
        scheduleMode: input.scheduleMode ?? "manual",
        frequencyUnit: input.frequencyUnit ?? null,
        frequencyValue: input.frequencyValue ?? null,
        config: input.config ?? null,
        ownerScope: input.ownerScope ?? "OWNER",
        createdAt: now,
        updatedAt: now,
      } satisfies Registration;
      rows.push(created);
      return created;
    }),
    listAutomations: vi.fn(async (filters?: {
      tenantId?: string | null;
      saasId?: string | null;
      automationKey?: string | null;
      enabled?: boolean | null;
    }) => rows.filter((item) => {
      if (filters?.tenantId && item.tenantId !== filters.tenantId) return false;
      if (filters?.saasId && item.saasId !== filters.saasId) return false;
      if (filters?.automationKey && item.automationKey !== filters.automationKey) return false;
      if (typeof filters?.enabled === "boolean" && item.enabled !== filters.enabled) return false;
      return true;
    })),
    enableAutomation: vi.fn(async (tenantId: string, saasId: string, automationKey: string) => {
      const existing = findRegistration(tenantId, saasId, automationKey);
      if (!existing) throw new HoistedAutomationCoreError("AUTOMATION_NOT_REGISTERED");
      existing.enabled = true;
      existing.updatedAt = new Date().toISOString();
      return existing;
    }),
    disableAutomation: vi.fn(async (tenantId: string, saasId: string, automationKey: string) => {
      const existing = findRegistration(tenantId, saasId, automationKey);
      if (!existing) throw new HoistedAutomationCoreError("AUTOMATION_NOT_REGISTERED");
      existing.enabled = false;
      existing.updatedAt = new Date().toISOString();
      return existing;
    }),
  };
});

vi.mock("@/lib/automation-core", () => ({
  AutomationCoreError,
  registerAutomation,
  getAutomation,
  listAutomations,
  enableAutomation,
  disableAutomation,
}));

import {
  getCampoBaseSocialAutomationRegistryItem,
  listCampoBaseSocialAutomationRegistryItems,
  listEnabledCampoBaseSocialAutomationRegistryItems,
  removeCampoBaseSocialAutomationRegistryItem,
  setCampoBaseSocialAutomationEnabled,
  upsertCampoBaseSocialAutomationRegistry,
} from "@/lib/campobase/social-automation-registry";

describe("campobase social automation registry", () => {
  beforeEach(() => {
    registrations.length = 0;
    vi.clearAllMocks();
    vi.useRealTimers();
  });

  it("delegates legacy adapter to canonical module", () => {
    const source = readFileSync(
      "src/lib/campobase/social-automation-registry.ts",
      "utf8",
    );

    expect(source).toContain("@/lib/campamento-base/social-automation-registry");
    expect(source).toContain("temporary compatibility adapter");
    expect(source).not.toContain("@/lib/db");
    expect(source).not.toContain("campobase_social_automation_registry");
  });

  it("keeps legacy public exports available", () => {
    expect(typeof upsertCampoBaseSocialAutomationRegistry).toBe("function");
    expect(typeof getCampoBaseSocialAutomationRegistryItem).toBe("function");
    expect(typeof listCampoBaseSocialAutomationRegistryItems).toBe("function");
    expect(typeof listEnabledCampoBaseSocialAutomationRegistryItems).toBe("function");
    expect(typeof setCampoBaseSocialAutomationEnabled).toBe("function");
    expect(typeof removeCampoBaseSocialAutomationRegistryItem).toBe("function");
  });

  it("upsert inserts new record with createdAt and updatedAt", async () => {
    vi.useFakeTimers();
    vi.setSystemTime(new Date("2024-01-01T00:00:00Z"));

    const item = await upsertCampoBaseSocialAutomationRegistry({
      tenantId: "tenant-a",
      saasId: "saas-a",
      niche: "fitness",
      tone: "direct",
      frequencyPerWeek: 3,
    });

    expect(registerAutomation).toHaveBeenCalledWith(expect.objectContaining({
      automationKey: "socialflow.content_generation",
      frequencyUnit: "week",
      frequencyValue: 3,
      config: {
        niche: "fitness",
        tone: "direct",
        frequencyPerWeek: 3,
      },
    }));
    expect(item.tenantId).toBe("tenant-a");
    expect(item.saasId).toBe("saas-a");
    expect(item.enabled).toBe(true);
    expect(item.createdAt).toBe("2024-01-01T00:00:00.000Z");
    expect(item.updatedAt).toBe("2024-01-01T00:00:00.000Z");
  });

  it("upsert preserves createdAt and updates updatedAt", async () => {
    vi.useFakeTimers();
    vi.setSystemTime(new Date("2024-01-01T00:00:00Z"));

    const initial = await upsertCampoBaseSocialAutomationRegistry({
      tenantId: "tenant-a",
      saasId: "saas-a",
      niche: "fitness",
      tone: "direct",
      frequencyPerWeek: 3,
    });

    vi.setSystemTime(new Date("2024-01-02T00:00:00Z"));
    const updated = await upsertCampoBaseSocialAutomationRegistry({
      tenantId: "tenant-a",
      saasId: "saas-a",
      niche: "health",
      tone: "calm",
      frequencyPerWeek: 5,
      enabled: false,
    });

    expect(updated.createdAt).toBe(initial.createdAt);
    expect(updated.updatedAt).toBe("2024-01-02T00:00:00.000Z");
    expect(updated.niche).toBe("health");
    expect(updated.tone).toBe("calm");
    expect(updated.frequencyPerWeek).toBe(5);
    expect(updated.enabled).toBe(false);
  });

  it("get returns item or null", async () => {
    const missing = await getCampoBaseSocialAutomationRegistryItem("tenant-x", "saas-x");
    expect(missing).toBeNull();

    await upsertCampoBaseSocialAutomationRegistry({
      tenantId: "tenant-a",
      saasId: "saas-a",
      niche: "fitness",
      tone: "direct",
      frequencyPerWeek: 3,
    });

    const found = await getCampoBaseSocialAutomationRegistryItem("tenant-a", "saas-a");
    expect(found?.saasId).toBe("saas-a");
  });

  it("list returns items from canonical automation registrations", async () => {
    await upsertCampoBaseSocialAutomationRegistry({
      tenantId: "tenant-a",
      saasId: "saas-a",
      niche: "one",
      tone: "t1",
      frequencyPerWeek: 1,
    });

    await upsertCampoBaseSocialAutomationRegistry({
      tenantId: "tenant-b",
      saasId: "saas-b",
      niche: "two",
      tone: "t2",
      frequencyPerWeek: 2,
    });

    const list = await listCampoBaseSocialAutomationRegistryItems();
    expect(list.map((item) => item.saasId)).toEqual(["saas-a", "saas-b"]);
    expect(listAutomations).toHaveBeenCalledWith({
      automationKey: "socialflow.content_generation",
    });
  });

  it("listEnabled returns only enabled items", async () => {
    await upsertCampoBaseSocialAutomationRegistry({
      tenantId: "tenant-a",
      saasId: "saas-a",
      niche: "one",
      tone: "t1",
      frequencyPerWeek: 1,
      enabled: true,
    });

    await upsertCampoBaseSocialAutomationRegistry({
      tenantId: "tenant-b",
      saasId: "saas-b",
      niche: "two",
      tone: "t2",
      frequencyPerWeek: 2,
      enabled: false,
    });

    const list = await listEnabledCampoBaseSocialAutomationRegistryItems();
    expect(list).toHaveLength(1);
    expect(list[0].saasId).toBe("saas-a");
  });

  it("setCampoBaseSocialAutomationEnabled updates enabled and updatedAt", async () => {
    await upsertCampoBaseSocialAutomationRegistry({
      tenantId: "tenant-a",
      saasId: "saas-a",
      niche: "one",
      tone: "t1",
      frequencyPerWeek: 1,
      enabled: true,
    });

    const updated = await setCampoBaseSocialAutomationEnabled("tenant-a", "saas-a", false);
    const missing = await setCampoBaseSocialAutomationEnabled("tenant-x", "saas-x", true);

    expect(updated?.enabled).toBe(false);
    expect(missing).toBeNull();
    expect(disableAutomation).toHaveBeenCalledWith("tenant-a", "saas-a", "socialflow.content_generation");
  });

  it("removeCampoBaseSocialAutomationRegistryItem follows canonical controlled behavior", async () => {
    await upsertCampoBaseSocialAutomationRegistry({
      tenantId: "tenant-a",
      saasId: "saas-a",
      niche: "one",
      tone: "t1",
      frequencyPerWeek: 1,
    });

    await expect(removeCampoBaseSocialAutomationRegistryItem("tenant-a", "saas-a")).rejects.toMatchObject({
      code: "SOCIAL_AUTOMATION_REGISTRY_REMOVE_UNSUPPORTED",
    });
    await expect(removeCampoBaseSocialAutomationRegistryItem("tenant-x", "saas-x")).resolves.toBe(false);
  });
});
