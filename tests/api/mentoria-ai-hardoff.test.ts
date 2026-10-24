import { describe, it, expect, beforeEach, afterEach, vi } from "vitest";

/**
 * INTEGRATION TEST: AI_HARD_OFF Kill-Switch
 * 
 * Validates that:
 * 1. AI_HARD_OFF=true disables all AI calls fail-closed
 * 2. AI_HARD_OFF=false or absent allows normal AI flow
 * 3. No env.AI.run is called when hard-off is active
 */

describe("AI_HARD_OFF kill-switch validation", () => {
  const originalEnv = { ...process.env };

  beforeEach(() => {
    vi.resetModules();
  });

  afterEach(() => {
    process.env = { ...originalEnv };
  });

  it("runMentoriaLlm throws MENTORIA_AI_NOT_AVAILABLE when AI_HARD_OFF=true", async () => {
    process.env.AI_HARD_OFF = "true";
    
    const { runMentoriaLlm } = await import("@/lib/agents/mentoria/llm-client");
    
    await expect(
      runMentoriaLlm([
        { role: "user", content: "test" }
      ])
    ).rejects.toThrow("MENTORIA_AI_NOT_AVAILABLE");
  });

  it("runMentoriaLlm throws MENTORIA_AI_NOT_AVAILABLE when AI_HARD_OFF=TRUE (case-insensitive)", async () => {
    process.env.AI_HARD_OFF = "TRUE";
    
    const { runMentoriaLlm } = await import("@/lib/agents/mentoria/llm-client");
    
    await expect(
      runMentoriaLlm([
        { role: "user", content: "test" }
      ])
    ).rejects.toThrow("MENTORIA_AI_NOT_AVAILABLE");
  });

  it("runMentoriaLlm fails with AI_BINDING_MISSING when AI_HARD_OFF=false and no binding exists", async () => {
    process.env.AI_HARD_OFF = "false";
    delete (process.env as any).AI;
    
    const { runMentoriaLlm } = await import("@/lib/agents/mentoria/llm-client");
    
    await expect(
      runMentoriaLlm([
        { role: "user", content: "test" }
      ])
    ).rejects.toThrow("AI_BINDING_MISSING");
  });

  it("runMentoriaLlm fails with AI_BINDING_MISSING when AI_HARD_OFF is absent and no binding exists", async () => {
    delete process.env.AI_HARD_OFF;
    delete (process.env as any).AI;
    
    const { runMentoriaLlm } = await import("@/lib/agents/mentoria/llm-client");
    
    await expect(
      runMentoriaLlm([
        { role: "user", content: "test" }
      ])
    ).rejects.toThrow("AI_BINDING_MISSING");
  });

  it("executeContentRequest throws DRAKO_CONTENT_PROVIDER_DISABLED when AI_HARD_OFF=true", async () => {
    process.env.AI_HARD_OFF = "true";
    
    const { executeContentRequest, createContentRequest } = await import("@/lib/drako/content");
    
    const request = createContentRequest({
      kind: "test.content",
      context: { userId: "test", tenantId: "test" },
      input: {},
      metadata: {
        messages: [{ role: "user", content: "test" }],
      },
    });
    
    await expect(executeContentRequest(request)).rejects.toThrow(
      "DRAKO_CONTENT_PROVIDER_DISABLED"
    );
  });

  it("executeContentRequest proceeds to AI check when AI_HARD_OFF=false", async () => {
    process.env.AI_HARD_OFF = "false";
    delete (process.env as any).AI;
    
    const { executeContentRequest, createContentRequest } = await import("@/lib/drako/content");
    
    const request = createContentRequest({
      kind: "test.content",
      context: { userId: "test", tenantId: "test" },
      input: {},
      metadata: {
        messages: [{ role: "user", content: "test" }],
      },
    });
    
    await expect(executeContentRequest(request)).rejects.toThrow(
      "DRAKO_CONTENT_PROVIDER_NOT_CONFIGURED"
    );
  });

  it("health/ai endpoint reflects AI_HARD_OFF state", async () => {
    process.env.AI_HARD_OFF = "true";
    
    const { GET: healthAiRoute } = await import("@/app/api/mentoria/health/ai/route");
    const response = await healthAiRoute();
    
    expect(response.status).toBe(503);
    const body = await response.json() as { status: string; error?: string };
    expect(body.status).toBe("unhealthy");
    expect(body.error).toBe("MENTORIA_AI_NOT_AVAILABLE");
  });
});
