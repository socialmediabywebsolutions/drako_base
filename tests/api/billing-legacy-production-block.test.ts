import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

const mocks = vi.hoisted(() => ({
  canonicalWebhookPost: vi.fn(),
}));

vi.mock("@/lib/cf", () => ({
  env: () => ({}),
}));

vi.mock("@/app/api/stripe/webhook/route", () => ({
  POST: mocks.canonicalWebhookPost,
}));

import { POST as legacyBillingWebhookPost } from "@/app/api/billing/webhook/route";
import { POST as legacyCheckoutStartPost } from "@/app/api/checkout/start/route";

describe("legacy billing routes blocked in production", () => {
  const originalNodeEnv = process.env.NODE_ENV;
  const originalEnvironment = process.env.ENVIRONMENT;

  beforeEach(() => {
    vi.clearAllMocks();
    process.env.NODE_ENV = "test";
    delete process.env.ENVIRONMENT;
    mocks.canonicalWebhookPost.mockResolvedValue(new Response(JSON.stringify({ received: true }), { status: 200 }));
  });

  afterEach(() => {
    process.env.NODE_ENV = originalNodeEnv;
    process.env.ENVIRONMENT = originalEnvironment;
  });

  it("returns 410 on legacy billing webhook in production", async () => {
    process.env.NODE_ENV = "production";
    const response = await legacyBillingWebhookPost(
      new Request("https://drako.systems/api/billing/webhook", { method: "POST", body: "{}" }),
    );
    expect(response.status).toBe(410);
    expect(mocks.canonicalWebhookPost).not.toHaveBeenCalled();
  });

  it("returns 410 on legacy checkout/start in production", async () => {
    process.env.NODE_ENV = "production";
    const response = await legacyCheckoutStartPost(
      new Request("https://drako.systems/api/checkout/start", {
        method: "POST",
        headers: { "content-type": "application/json" },
        body: JSON.stringify({ sessionId: "sess_legacy" }),
      }),
    );
    expect(response.status).toBe(410);
  });
});
