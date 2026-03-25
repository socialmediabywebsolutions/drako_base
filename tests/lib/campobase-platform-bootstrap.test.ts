import { beforeEach, describe, expect, it, vi } from "vitest";

const socialflowBootstrap = vi.hoisted(() => vi.fn());
const clinicBootstrap = vi.hoisted(() => vi.fn());
const taskopsBootstrap = vi.hoisted(() => vi.fn());

vi.mock("@/lib/campobase/socialflow-platform", () => ({
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
  beforeEach(() => {
    vi.clearAllMocks();
    vi.resetModules();
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
