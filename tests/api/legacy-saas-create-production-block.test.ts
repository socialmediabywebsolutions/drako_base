import { describe, expect, it, vi } from "vitest";

vi.mock("@/lib/security/production-gate", () => ({
  isProductionEnvironment: vi.fn(() => true),
}));

import { POST as postSaas } from "@/app/api/saas/route";
import { POST as postProvisionCommit } from "@/app/api/provision/commit/route";

describe("legacy SaaS creation routes are blocked in production", () => {
  it("blocks POST /api/saas with 410", async () => {
    const response = await postSaas(
      new Request("https://drako.systems/api/saas", {
        method: "POST",
        headers: { "content-type": "application/json" },
        body: JSON.stringify({ name: "Legacy SaaS", slug: "legacy-saas" }),
      }),
    );

    expect(response.status).toBe(410);
    const payload = await response.json() as { code: string; message: string };
    expect(payload.code).toBe("LEGACY_SAAS_CREATE_DEPRECATED");
    expect(payload.message).toContain("/api/factory/provisioning/create-saas");
  });

  it("blocks POST /api/provision/commit with 410", async () => {
    const response = await postProvisionCommit(
      new Request("https://drako.systems/api/provision/commit", {
        method: "POST",
        headers: { "content-type": "application/json" },
        body: JSON.stringify({ sessionId: "sess_1", name: "Legacy SaaS", slug: "legacy-saas" }),
      }),
    );

    expect(response.status).toBe(410);
    const payload = await response.json() as { code: string; message: string };
    expect(payload.code).toBe("LEGACY_PROVISION_COMMIT_BLOCKED");
    expect(payload.message).toContain("/api/factory/provisioning/create-saas");
  });
});
