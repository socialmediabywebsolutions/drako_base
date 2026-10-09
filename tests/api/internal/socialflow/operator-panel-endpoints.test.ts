import { beforeEach, describe, expect, it, vi } from "vitest";

// P6: endpoints del contrato que alimentan el panel del operator del holding.

const env = vi.hoisted(() => vi.fn());
const listSocialCorsTenants = vi.hoisted(() => vi.fn());
const getSocialCorsAgentControlCenter = vi.hoisted(() => vi.fn());
const listHighChurnRiskTenants = vi.hoisted(() => vi.fn());
const generateSocialflowWhatsappReply = vi.hoisted(() => vi.fn());

vi.mock("@/lib/cf", () => ({ env }));
vi.mock("@/lib/socialflow/internal-api/operator-actions", () => ({ listSocialCorsTenants }));
vi.mock("@/lib/socialflow/internal-api/agent-control-center", () => ({ getSocialCorsAgentControlCenter }));
vi.mock("@/lib/socialflow/ai/agents/ChurnPredictionAgent", () => ({ listHighChurnRiskTenants }));
vi.mock("@/lib/socialflow/ai/whatsapp-reply", () => ({ generateSocialflowWhatsappReply }));

import { GET as getTenants } from "@/app/api/internal/socialflow/tenants/route";
import { GET as getAgents } from "@/app/api/internal/socialflow/agents/status/route";
import { GET as getChurn } from "@/app/api/internal/socialflow/churn-risk/route";
import { POST as postWhatsapp } from "@/app/api/internal/socialflow/whatsapp/reply/route";

const AUTH = {
  Authorization: "Bearer test-service-token",
  "X-Drako-Control-Plane": "campobase",
  "X-Drako-Request-Id": "req-panel",
};

function get(path: string, headers: HeadersInit = AUTH) {
  return new Request(`https://socialflows.drako.systems${path}`, { headers });
}

describe("operator panel endpoints of the internal contract", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    process.env.SOCIALFLOW_INTERNAL_SERVICE_TOKEN_TEST = "test-service-token";
    delete process.env.SOCIALFLOW_INTERNAL_SERVICE_TOKEN;
    env.mockReturnValue({ SOCIAL_DB: {} });
  });

  it("every endpoint rejects requests without the service token", async () => {
    const noAuth = { "X-Drako-Control-Plane": "campobase", "X-Drako-Request-Id": "r" };
    expect((await getTenants(get("/api/internal/socialflow/tenants", noAuth))).status).toBe(401);
    expect((await getAgents(get("/api/internal/socialflow/agents/status", noAuth))).status).toBe(401);
    expect((await getChurn(get("/api/internal/socialflow/churn-risk", noAuth))).status).toBe(401);
    const whatsapp = await postWhatsapp(new Request("https://x/api/internal/socialflow/whatsapp/reply", { method: "POST", headers: noAuth, body: "{}" }));
    expect(whatsapp.status).toBe(401);
    expect(listSocialCorsTenants).not.toHaveBeenCalled();
    expect(generateSocialflowWhatsappReply).not.toHaveBeenCalled();
  });

  it("GET tenants lists SocialCors tenants", async () => {
    listSocialCorsTenants.mockResolvedValue([{ id: "t1", tenantId: "t1", saasId: "socialflow", name: "Gym", niche: "fitness", plan: "pro" }]);
    const response = await getTenants(get("/api/internal/socialflow/tenants"));
    expect(response.status).toBe(200);
    expect(response.headers.get("X-SocialCors-Contract-Version")).toBe("2026-10-09");
    const payload = await response.json() as { tenants: unknown[]; runtime: string };
    expect(payload.runtime).toBe("socialcors");
    expect(payload.tenants).toHaveLength(1);
  });

  it("GET tenants returns 503 without SOCIAL_DB", async () => {
    env.mockReturnValue({});
    expect((await getTenants(get("/api/internal/socialflow/tenants"))).status).toBe(503);
  });

  it("GET agents/status returns the agent control center groups", async () => {
    getSocialCorsAgentControlCenter.mockResolvedValue([{ key: "cerebro", titleEs: "Cerebro", agents: [] }]);
    const payload = await (await getAgents(get("/api/internal/socialflow/agents/status"))).json() as { groups: unknown[] };
    expect(payload.groups).toEqual([{ key: "cerebro", titleEs: "Cerebro", agents: [] }]);
  });

  it("GET churn-risk clamps minScore to 0..100", async () => {
    listHighChurnRiskTenants.mockResolvedValue([]);
    const payload = await (await getChurn(get("/api/internal/socialflow/churn-risk?minScore=500"))).json() as { minScore: number };
    expect(payload.minScore).toBe(100);
    expect(listHighChurnRiskTenants).toHaveBeenCalledWith({ SOCIAL_DB: {} }, 100);
  });

  it("POST whatsapp/reply validates input and returns the generated reply", async () => {
    const bad = await postWhatsapp(new Request("https://x/api/internal/socialflow/whatsapp/reply", { method: "POST", headers: AUTH, body: JSON.stringify({ tenantId: "t1" }) }));
    expect(bad.status).toBe(400);

    generateSocialflowWhatsappReply.mockResolvedValue("¡Hola! Te ayudo.");
    const ok = await postWhatsapp(new Request("https://x/api/internal/socialflow/whatsapp/reply", {
      method: "POST",
      headers: AUTH,
      body: JSON.stringify({ tenantId: "t1", saasId: "socialflow", message: "Hola" }),
    }));
    expect(ok.status).toBe(200);
    expect(await ok.json()).toMatchObject({ handled: true, reply: "¡Hola! Te ayudo.", error: null });
    expect(generateSocialflowWhatsappReply).toHaveBeenCalledWith({ tenantId: "t1", saasId: "socialflow", message: "Hola" });
  });

  it("POST whatsapp/reply reports handled=false instead of failing when generation throws", async () => {
    generateSocialflowWhatsappReply.mockRejectedValue(new Error("AI_DOWN"));
    const response = await postWhatsapp(new Request("https://x/api/internal/socialflow/whatsapp/reply", {
      method: "POST",
      headers: AUTH,
      body: JSON.stringify({ tenantId: "t1", saasId: "socialflow", message: "Hola" }),
    }));
    expect(await response.json()).toMatchObject({ handled: false, reply: null, error: "AI_DOWN" });
  });
});
