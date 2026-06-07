import { beforeEach, describe, expect, it, vi } from "vitest";
import { readFileSync } from "node:fs";
import { join } from "node:path";

const socialflowBootstrap = vi.hoisted(() => vi.fn());
const clinicBootstrap = vi.hoisted(() => vi.fn());
const taskopsBootstrap = vi.hoisted(() => vi.fn());

vi.mock("@/lib/campamento-base/socialflow-platform", () => ({
  socialFlowPlatformDefinition: {
    saasId: "socialflow",
    displayName: "SocialFlow",
    supportsOperatorSurface: true,
    automations: [],
    integrations: [],
    matchesSaasId: (saasId: string) => saasId.includes("socialflow"),
  },
  socialFlowPlatformBootstrap: {
    saasId: "socialflow",
    connect: socialflowBootstrap,
  },
}));

vi.mock("@/lib/campobase/clinic-platform", () => ({
  clinicPlatformDefinition: {
    saasId: "clinic",
    displayName: "Clinic",
    supportsOperatorSurface: true,
    automations: [],
    integrations: [],
    matchesSaasId: (saasId: string) => saasId.includes("clinic"),
  },
  clinicPlatformBootstrap: {
    saasId: "clinic",
    connect: clinicBootstrap,
  },
}));

vi.mock("@/lib/campobase/taskops-platform", () => ({
  taskOpsPlatformDefinition: {
    saasId: "taskops",
    displayName: "TaskOps",
    supportsOperatorSurface: true,
    automations: [],
    integrations: [],
    matchesSaasId: (saasId: string) => saasId.includes("taskops"),
  },
  taskOpsPlatformBootstrap: {
    saasId: "taskops",
    connect: taskopsBootstrap,
  },
}));

describe("platform bootstrap contract", () => {
  const bootstrapPath = join(process.cwd(), "src", "lib", "campobase", "platform-bootstrap.ts");

  beforeEach(() => {
    vi.clearAllMocks();
    vi.resetModules();
  });

  it("uses canonical SocialFlow import while keeping Clinic and TaskOps legacy imports", () => {
    const source = readFileSync(bootstrapPath, "utf8");
    const legacyPrefix = "@/lib/" + "campobase/";

    expect(source).toContain('import("@/lib/campamento-base/socialflow-platform")');
    expect(source.includes(`${legacyPrefix}socialflow-platform`)).toBe(false);

    const legacyDynamicImports = source
      .split("\n")
      .map((line) => line.trim())
      .filter((line) => line.includes("await import(\"") && line.includes(legacyPrefix));

    expect(legacyDynamicImports).toHaveLength(2);
    expect(legacyDynamicImports.some((line) => line.includes("clinic-platform"))).toBe(true);
    expect(legacyDynamicImports.some((line) => line.includes("taskops-platform"))).toBe(true);
    expect(legacyDynamicImports.some((line) => line.includes("socialflow-platform"))).toBe(false);
  });

  it("loads SocialFlow through the shared SaaS contract loader", async () => {
    const { loadPlatformForSaas } = await import("@/lib/campobase/platform-bootstrap");

    await loadPlatformForSaas("tenant_socialflow", "socialflow");

    expect(socialflowBootstrap).toHaveBeenCalledWith({
      tenantId: "tenant_socialflow",
      saasId: "socialflow",
    });
    expect(clinicBootstrap).not.toHaveBeenCalled();
  });

  it("loads Clinic through the shared SaaS contract loader", async () => {
    const { loadPlatformForSaas } = await import("@/lib/campobase/platform-bootstrap");

    await loadPlatformForSaas("tenant_clinic", "saas_clinic");

    expect(clinicBootstrap).toHaveBeenCalledWith({
      tenantId: "tenant_clinic",
      saasId: "saas_clinic",
    });
    expect(socialflowBootstrap).not.toHaveBeenCalled();
  });

  it("keeps explicit per-SaaS bootstrap helpers available", async () => {
    const { registerSocialFlowPlatform, registerClinicPlatform, registerTaskOpsPlatform } = await import("@/lib/campobase/platform-bootstrap");

    await registerSocialFlowPlatform("tenant_socialflow", "socialflow");
    await registerClinicPlatform("tenant_clinic", "saas_clinic");
    await registerTaskOpsPlatform("tenant_taskops", "saas_taskops");

    expect(socialflowBootstrap).toHaveBeenCalledWith({
      tenantId: "tenant_socialflow",
      saasId: "socialflow",
    });
    expect(clinicBootstrap).toHaveBeenCalledWith({
      tenantId: "tenant_clinic",
      saasId: "saas_clinic",
    });
    expect(taskopsBootstrap).toHaveBeenCalledWith({
      tenantId: "tenant_taskops",
      saasId: "saas_taskops",
    });
  });

  it("loads TaskOps through the shared SaaS contract loader", async () => {
    const { loadPlatformForSaas } = await import("@/lib/campobase/platform-bootstrap");

    await loadPlatformForSaas("tenant_taskops", "saas_taskops");

    expect(taskopsBootstrap).toHaveBeenCalledWith({
      tenantId: "tenant_taskops",
      saasId: "saas_taskops",
    });
    expect(socialflowBootstrap).not.toHaveBeenCalled();
    expect(clinicBootstrap).not.toHaveBeenCalled();
  });
});
