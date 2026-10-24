import { describe, expect, it, vi } from "vitest";

const env = vi.hoisted(() => vi.fn());

vi.mock("@/lib/cf", () => ({
  env,
}));

import {
  isAutoPublishBlockedByPrivatePilotMode,
  isPrivatePilotModeEnabled,
  isTenantAllowedInPrivatePilot,
} from "@/lib/socialflow/private-pilot";

describe("socialflow private pilot gates", () => {
  it("keeps gates disabled when mode flag is absent", () => {
    env.mockReturnValue({});

    expect(isPrivatePilotModeEnabled()).toBe(false);
    expect(isAutoPublishBlockedByPrivatePilotMode()).toBe(false);
    expect(isTenantAllowedInPrivatePilot("tenant-a")).toBe(true);
  });

  it("enforces tenant allowlist when pilot mode is enabled", () => {
    env.mockReturnValue({
      SOCIALFLOW_PRIVATE_PILOT_MODE: "true",
      SOCIALFLOW_PRIVATE_PILOT_TENANT_ALLOWLIST: "tenant-a, tenant-b",
    });

    expect(isPrivatePilotModeEnabled()).toBe(true);
    expect(isAutoPublishBlockedByPrivatePilotMode()).toBe(true);
    expect(isTenantAllowedInPrivatePilot("tenant-a")).toBe(true);
    expect(isTenantAllowedInPrivatePilot("tenant-c")).toBe(false);
  });
});
