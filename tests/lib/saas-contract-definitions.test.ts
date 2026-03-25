import { describe, expect, it } from "vitest";

import { clinicPlatformBootstrap, clinicPlatformDefinition } from "@/lib/campobase/clinic-platform";
import { socialFlowPlatformBootstrap, socialFlowPlatformDefinition } from "@/lib/campobase/socialflow-platform";
import { taskOpsPlatformBootstrap, taskOpsPlatformDefinition } from "@/lib/campobase/taskops-platform";

describe("saas contract definitions", () => {
  it("SocialFlow exposes a valid static platform definition", () => {
    expect(socialFlowPlatformDefinition).toMatchObject({
      saasId: "socialflow",
      displayName: "SocialFlow",
      supportsOperatorSurface: true,
    });
    expect(socialFlowPlatformDefinition.automations).toEqual(
      expect.arrayContaining([
        expect.objectContaining({
          automationKey: "socialflow.content_generation",
          enabledByDefault: true,
        }),
        expect.objectContaining({
          automationKey: "socialflow.health_check",
          enabledByDefault: true,
        }),
      ]),
    );
    expect(socialFlowPlatformDefinition.integrations).toEqual(
      expect.arrayContaining([
        expect.objectContaining({
          integrationKey: "linkedin",
          required: false,
        }),
      ]),
    );
    expect("handler" in socialFlowPlatformDefinition.automations[0]).toBe(false);
    expect("provider" in socialFlowPlatformDefinition.integrations[0]).toBe(false);
    expect("tenantId" in socialFlowPlatformDefinition).toBe(false);
    expect("bootstrap" in socialFlowPlatformDefinition).toBe(false);
    expect(typeof socialFlowPlatformBootstrap.connect).toBe("function");
  });

  it("Clinic exposes a valid static platform definition", () => {
    expect(clinicPlatformDefinition).toMatchObject({
      saasId: "clinic",
      displayName: "Clinic",
      supportsOperatorSurface: true,
    });
    expect(clinicPlatformDefinition.automations).toEqual(
      expect.arrayContaining([
        expect.objectContaining({
          automationKey: "clinic.daily_appointment_health",
          enabledByDefault: true,
        }),
      ]),
    );
    expect(clinicPlatformDefinition.integrations).toEqual(
      expect.arrayContaining([
        expect.objectContaining({
          integrationKey: "whatsapp",
          required: false,
        }),
      ]),
    );
    expect("handler" in clinicPlatformDefinition.automations[0]).toBe(false);
    expect("provider" in clinicPlatformDefinition.integrations[0]).toBe(false);
    expect("tenantId" in clinicPlatformDefinition).toBe(false);
    expect("bootstrap" in clinicPlatformDefinition).toBe(false);
    expect(typeof clinicPlatformBootstrap.connect).toBe("function");
  });

  it("TaskOps exposes a valid static platform definition", () => {
    expect(taskOpsPlatformDefinition).toMatchObject({
      saasId: "taskops",
      displayName: "TaskOps",
      supportsOperatorSurface: true,
    });
    expect(taskOpsPlatformDefinition.automations).toEqual(
      expect.arrayContaining([
        expect.objectContaining({
          automationKey: "taskops.pending_task_audit",
          enabledByDefault: true,
        }),
      ]),
    );
    expect(taskOpsPlatformDefinition.integrations).toEqual(
      expect.arrayContaining([
        expect.objectContaining({
          integrationKey: "whatsapp",
          required: false,
        }),
      ]),
    );
    expect("tenantId" in taskOpsPlatformDefinition).toBe(false);
    expect("bootstrap" in taskOpsPlatformDefinition).toBe(false);
    expect(typeof taskOpsPlatformBootstrap.connect).toBe("function");
  });
});
