import { describe, expect, it } from "vitest";

import { POST as postAi } from "@/app/api/factory/provisioning/ai/route";
import { POST as postBranding } from "@/app/api/factory/provisioning/branding/route";
import { POST as postEdge } from "@/app/api/factory/provisioning/edge/route";
import { POST as postGdpr } from "@/app/api/factory/provisioning/gdpr/route";
import { POST as postMarketing } from "@/app/api/factory/provisioning/marketing/route";
import { POST as postModules } from "@/app/api/factory/provisioning/modules/route";

const routes = [
  ["marketing", postMarketing],
  ["modules", postModules],
  ["branding", postBranding],
  ["edge", postEdge],
  ["ai", postAi],
  ["gdpr", postGdpr],
] as const;

describe("legacy factory provisioning routes", () => {
  it.each(routes)("blocks %s even if the caller spoofs tenant headers", async (_name, handler) => {
    const response = await handler(
      new Request("https://drako.systems/api/factory/provisioning/test", {
        method: "POST",
        headers: {
          "content-type": "application/json",
          "x-drako-tenant-id": "spoofed_tenant",
        },
        body: JSON.stringify({ saasId: "saas_1" }),
      }),
    );

    expect(response.status).toBe(410);
    await expect(response.json()).resolves.toMatchObject({
      ok: false,
      error: "FACTORY_PROVISIONING_ROUTE_BLOCKED",
    });
  });
});
