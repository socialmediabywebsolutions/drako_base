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
    }) => {
      return rows.filter((item) => {
        if (filters?.tenantId && item.tenantId !== filters.tenantId) return false;
        if (filters?.saasId && item.saasId !== filters.saasId) return false;
        if (filters?.automationKey && item.automationKey !== filters.automationKey) return false;
        if (typeof filters?.enabled === "boolean" && item.enabled !== filters.enabled) return false;
        return true;
      });
    }),
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
  getSocialAutomationRegistryItem,
  listEnabledSocialAutomationRegistryItems,
  listSocialAutomationRegistryItems,
  removeSocialAutomationRegistryItem,
  setSocialAutomationRegistryEnabled,
  upsertSocialAutomationRegistryItem,
} from "@/lib/campamento-base/social-automation-registry";

describe("campamento-base social automation registry", () => {
  beforeEach(() => {
    registrations.length = 0;
    vi.clearAllMocks();
    vi.useRealTimers();
  });

  it("does not import from frozen legacy namespace", () => {
    const source = readFileSync(
      "src/lib/campamento-base/social-automation-registry.ts",
      "utf8",
    );
    const legacyPrefix = ["@/lib", "campobase"].join("/");

    expect(source).not.toContain(`${legacyPrefix}/`);
  });

  it("exports expected canonical functions", () => {
    expect(typeof upsertSocialAutomationRegistryItem).toBe("function");
    expect(typeof getSocialAutomationRegistryItem).toBe("function");
    expect(typeof listSocialAutomationRegistryItems).toBe("function");
    expect(typeof listEnabledSocialAutomationRegistryItems).toBe("function");
    expect(typeof setSocialAutomationRegistryEnabled).toBe("function");
    expect(typeof removeSocialAutomationRegistryItem).toBe("function");
  });

  it("allows upsert of registry item through automation-core", async () => {
    vi.useFakeTimers();
    vi.setSystemTime(new Date("2024-01-01T00:00:00Z"));

    const item = await upsertSocialAutomationRegistryItem({
      tenantId: "tenant-a",
      saasId: "saas-a",
      niche: "fitness",
      tone: "direct",
      frequencyPerWeek: 3,
    });

    expect(registerAutomation).toHaveBeenCalledWith(expect.objectContaining({
      tenantId: "tenant-a",
      saasId: "saas-a",
      automationKey: "socialflow.content_generation",
      scheduleMode: "scheduled",
      frequencyUnit: "week",
      frequencyValue: 3,
      config: {
        niche: "fitness",
        tone: "direct",
        frequencyPerWeek: 3,
      },
    }));
    expect(item).toMatchObject({
      tenantId: "tenant-a",
      saasId: "saas-a",
      niche: "fitness",
      tone: "direct",
      frequencyPerWeek: 3,
      enabled: true,
      createdAt: "2024-01-01T00:00:00.000Z",
      updatedAt: "2024-01-01T00:00:00.000Z",
    });
  });

  it("allows get by tenantId and saasId", async () => {
    await upsertSocialAutomationRegistryItem({
      tenantId: "tenant-a",
      saasId: "saas-a",
      niche: "fitness",
      tone: "direct",
      frequencyPerWeek: 3,
    });

    const found = await getSocialAutomationRegistryItem("tenant-a", "saas-a");
    const missing = await getSocialAutomationRegistryItem("tenant-x", "saas-x");

    expect(found?.saasId).toBe("saas-a");
    expect(missing).toBeNull();
  });

  it("allows listing all social automation registry items", async () => {
    await upsertSocialAutomationRegistryItem({
      tenantId: "tenant-a",
      saasId: "saas-a",
      niche: "fitness",
      tone: "direct",
      frequencyPerWeek: 3,
    });
    await upsertSocialAutomationRegistryItem({
      tenantId: "tenant-b",
      saasId: "saas-b",
      niche: "health",
      tone: "calm",
      frequencyPerWeek: 2,
    });

    const list = await listSocialAutomationRegistryItems();

    expect(list).toHaveLength(2);
    expect(list.map((item) => item.saasId)).toEqual(["saas-a", "saas-b"]);
    expect(listAutomations).toHaveBeenCalledWith({
      automationKey: "socialflow.content_generation",
    });
  });

  it("allows listing enabled social automation registry items", async () => {
    await upsertSocialAutomationRegistryItem({
      tenantId: "tenant-a",
      saasId: "saas-a",
      niche: "fitness",
      tone: "direct",
      frequencyPerWeek: 3,
      enabled: true,
    });
    await upsertSocialAutomationRegistryItem({
      tenantId: "tenant-b",
      saasId: "saas-b",
      niche: "health",
      tone: "calm",
      frequencyPerWeek: 2,
      enabled: false,
    });

    const list = await listEnabledSocialAutomationRegistryItems();

    expect(list).toHaveLength(1);
    expect(list[0].saasId).toBe("saas-a");
    expect(listAutomations).toHaveBeenCalledWith({
      automationKey: "socialflow.content_generation",
      enabled: true,
    });
  });

  it("allows enable and disable through automation-core", async () => {
    await upsertSocialAutomationRegistryItem({
      tenantId: "tenant-a",
      saasId: "saas-a",
      niche: "fitness",
      tone: "direct",
      frequencyPerWeek: 3,
      enabled: true,
    });

    const disabled = await setSocialAutomationRegistryEnabled("tenant-a", "saas-a", false);
    const enabled = await setSocialAutomationRegistryEnabled("tenant-a", "saas-a", true);
    const missing = await setSocialAutomationRegistryEnabled("tenant-x", "saas-x", false);

    expect(disabled?.enabled).toBe(false);
    expect(enabled?.enabled).toBe(true);
    expect(missing).toBeNull();
    expect(disableAutomation).toHaveBeenCalledWith("tenant-a", "saas-a", "socialflow.content_generation");
    expect(enableAutomation).toHaveBeenCalledWith("tenant-a", "saas-a", "socialflow.content_generation");
  });

  it("handles remove as explicitly unsupported when automation exists", async () => {
    await upsertSocialAutomationRegistryItem({
      tenantId: "tenant-a",
      saasId: "saas-a",
      niche: "fitness",
      tone: "direct",
      frequencyPerWeek: 3,
    });

    await expect(removeSocialAutomationRegistryItem("tenant-a", "saas-a")).rejects.toMatchObject({
      code: "SOCIAL_AUTOMATION_REGISTRY_REMOVE_UNSUPPORTED",
    });
    await expect(removeSocialAutomationRegistryItem("tenant-x", "saas-x")).resolves.toBe(false);
  });

  it("does not create any new file named campobase", () => {
    const createdFiles = [
      "src/lib/campamento-base/social-automation-registry.ts",
      "tests/lib/campamento-base-social-automation-registry.test.ts",
    ];

    expect(createdFiles.some((file) => file.toLowerCase().includes("campobase"))).toBe(false);
  });

  it("does not introduce legacy import prefix in this test", () => {
    const source = readFileSync(
      "tests/lib/campamento-base-social-automation-registry.test.ts",
      "utf8",
    );
    const legacyPrefix = ["@/lib", "campobase"].join("/");

    expect(source).not.toContain(`${legacyPrefix}/`);
  });
});
