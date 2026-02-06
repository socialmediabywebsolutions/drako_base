import { describe, it, expect, vi, beforeEach } from "vitest";
import { handleAiRunRequest, AiRunPayload } from "../api/ai";
import { AutopilotEnv } from "../index";

describe("AI Router v1.1 - Steel Governance", () => {
    let env: AutopilotEnv;
    let db: any;
    let ai: any;

    beforeEach(() => {
        db = {
            prepare: vi.fn().mockReturnThis(),
            bind: vi.fn().mockReturnThis(),
            all: vi.fn(),
            first: vi.fn(),
            run: vi.fn().mockResolvedValue({}),
            batch: vi.fn().mockResolvedValue([]),
        };
        ai = {
            run: vi.fn().mockResolvedValue({ response: "AI Response", usage: { total_tokens: 10 } }),
        };
        env = {
            DRACO_DB: db,
            AI: ai,
            VERCEL_TO_WORKER_SECRET: "proxy-secret",
            X_DRAKO_ORIGIN_SECRET: "origin-secret",
        } as any;
    });

    const mockPayload: AiRunPayload = {
        messages: [{ role: "user", content: "Hello" }],
        taskType: "marketing_copy",
        mode: "smart"
    };

    it("should reject unauthorized requests (missing secret)", async () => {
        const req = new Request("https://worker/internal/ai/run", {
            method: "POST",
            body: JSON.stringify(mockPayload),
            headers: {
                "Authorization": "Bearer wrong",
                "X-Drako-Origin-Secret": "origin-secret"
            }
        });
        const res = await handleAiRunRequest(req, env);
        expect(res.status).toBe(401);
    });

    it("should resolve policy and execute successfully", async () => {
        // Mock Rate Limit: OK
        db.first.mockResolvedValueOnce({ count: 1 });
        // Mock Budget: OK
        db.first.mockResolvedValueOnce({ total: 100 });
        // Mock Policy: Cloudflare
        db.first.mockResolvedValueOnce({ provider: "cloudflare", model: "@cf/meta/llama-3.1-70b-instruct" });
        // Mock Breaker: CLOSED
        db.first.mockResolvedValueOnce({ state: "CLOSED", opened_at: null });

        const req = new Request("https://worker/internal/ai/run", {
            method: "POST",
            body: JSON.stringify(mockPayload),
            headers: {
                "Authorization": "Bearer proxy-secret",
                "X-Drako-Origin-Secret": "origin-secret",
                "X-Drako-Correlation-Id": "test-correlation-id"
            }
        });

        const res = await handleAiRunRequest(req, env);
        expect(res.status).toBe(200);
        const data = await res.json() as any;
        expect(data.ok).toBe(true);
        expect(data.content).toBe("AI Response");
        expect(data.correlationId).toBe("test-correlation-id");
    });

    it("should return 402 when quota exceeded", async () => {
        // Mock Rate Limit: OK
        db.first.mockResolvedValueOnce({ count: 1 });
        // Mock Budget: EXCEEDED
        db.first.mockResolvedValueOnce({ total: 10_000_000 });

        const req = new Request("https://worker/internal/ai/run", {
            method: "POST",
            body: JSON.stringify(mockPayload),
            headers: {
                "Authorization": "Bearer proxy-secret",
                "X-Drako-Origin-Secret": "origin-secret"
            }
        });

        const res = await handleAiRunRequest(req, env);
        expect(res.status).toBe(402);
        const data = await res.json() as any;
        expect(data.error).toBe("QUOTA_EXCEEDED");
    });

    it("should return 429 when rate limited", async () => {
        // Mock Rate Limit: EXCEEDED
        db.first.mockResolvedValueOnce({ count: 100 });

        const req = new Request("https://worker/internal/ai/run", {
            method: "POST",
            body: JSON.stringify(mockPayload),
            headers: {
                "Authorization": "Bearer proxy-secret",
                "X-Drako-Origin-Secret": "origin-secret"
            }
        });

        const res = await handleAiRunRequest(req, env);
        expect(res.status).toBe(429);
    });

    it("should fallback to Cloudflare when circuit is OPEN for external provider", async () => {
        // Mock Rate Limit: OK
        db.first.mockResolvedValueOnce({ count: 1 });
        // Mock Budget: OK
        db.first.mockResolvedValueOnce({ total: 100 });
        // Mock Policy: OpenAI (External)
        db.first.mockResolvedValueOnce({ provider: "openai", model: "gpt-4" });
        // Mock Breaker: OPEN
        db.first.mockResolvedValueOnce({ state: "OPEN", opened_at: new Date().toISOString() });
        // Mock Secondary Policy (Fallback): Cloudflare
        db.first.mockResolvedValueOnce({ provider: "cloudflare", model: "@cf/meta/llama-3-8b-instruct" });

        const req = new Request("https://worker/internal/ai/run", {
            method: "POST",
            body: JSON.stringify(mockPayload),
            headers: {
                "Authorization": "Bearer proxy-secret",
                "X-Drako-Origin-Secret": "origin-secret"
            }
        });

        const res = await handleAiRunRequest(req, env);
        expect(res.status).toBe(200);
        const data = await res.json() as any;
        expect(data.provider).toBe("cloudflare");
    });
});
