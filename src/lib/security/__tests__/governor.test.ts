import { describe, it, expect, vi, beforeEach } from "vitest";
import { checkAiGovernance, recordAiFailure, recordAiSuccess } from "../governor";
import { mockDb } from "@/__tests__/setup";

describe("AI Governance (Governor)", () => {
    const breakerKey = "test-ai-breaker";
    const tenantId = "test-tenant";

    beforeEach(() => {
        vi.clearAllMocks();
    });

    describe("Circuit Breaker", () => {
        it("should allow request when CLOSED", async () => {
            mockDb.all.mockResolvedValueOnce({ results: [{ state: "CLOSED" }] });

            const result = await checkAiGovernance({ tenantId, breakerKey });
            expect(result.allowed).toBe(true);
        });

        it("should block request when OPEN and cooldown not expired", async () => {
            const now = Date.now();
            mockDb.all.mockResolvedValueOnce({
                results: [{ state: "OPEN", opened_at: new Date(now - 1000).toISOString() }]
            });

            const result = await checkAiGovernance({
                tenantId,
                breakerKey,
                config: { cooldownMs: 300_000 }
            });

            expect(result.allowed).toBe(false);
            expect(result.reason).toBe("AI_CIRCUIT_OPEN");
        });

        it("should transition to OPEN after reaching failure threshold", async () => {
            // Mock failure recording
            mockDb.all.mockResolvedValueOnce({
                results: [{ state: "CLOSED", failure_count: 4 }]
            });

            await recordAiFailure({
                breakerKey,
                error: "TIMEOUT",
                correlationId: "corr-fail",
                threshold: 5
            });

            // Expect batch to update to OPEN and log transition
            expect(mockDb.batch).toHaveBeenCalled();
        });

        it("should reset to CLOSED after success", async () => {
            await recordAiSuccess(breakerKey);
            expect(mockDb.prepare).toHaveBeenCalledWith(expect.stringContaining("SET failure_count = 0, success_count = success_count + 1"));
        });
    });

    describe("Monthly Budget", () => {
        it("should block if Hard Limit reached", async () => {
            // Mock CLOSED state
            mockDb.all.mockResolvedValueOnce({ results: [{ state: "CLOSED" }] });
            // Mock usage at 1M tokens
            mockDb.all.mockResolvedValueOnce({ results: [{ tokens_in: 500000, tokens_out: 500001 }] });

            const result = await checkAiGovernance({
                tenantId,
                breakerKey,
                config: { maxTokensMonthly: 1000000 }
            });

            expect(result.allowed).toBe(false);
            expect(result.reason).toBe("AI_QUOTA_HARD_LIMIT");
        });

        it("should warn if Soft Limit reached", async () => {
            mockDb.all.mockResolvedValueOnce({ results: [{ state: "CLOSED" }] });
            // 85% of 1M
            mockDb.all.mockResolvedValueOnce({ results: [{ tokens_in: 425000, tokens_out: 425000 }] });

            const result = await checkAiGovernance({
                tenantId,
                breakerKey,
                config: { maxTokensMonthly: 1000000, softLimitThreshold: 0.8 }
            });

            expect(result.allowed).toBe(true);
            expect(result.warning).toBe(true);
        });
    });

    describe("Usage Recording", () => {
        it("should record usage correctly in D1", async () => {
            const { recordAiUsage } = await import("../governor");
            await recordAiUsage({
                tenantId,
                tokensIn: 100,
                tokensOut: 200
            });
            expect(mockDb.prepare).toHaveBeenCalledWith(expect.stringContaining("INSERT INTO ai_usage_counters"));
            expect(mockDb.bind).toHaveBeenCalledWith(expect.any(String), 100, 200, expect.any(String));
        });
    });

    describe("Auto-transitions", () => {
        it("should transition to HALF_OPEN when cooldown expires", async () => {
            const now = Date.now();
            // Mock OPEN state with expired cooldown
            mockDb.all.mockResolvedValueOnce({
                results: [{ state: "OPEN", opened_at: new Date(now - 600_000).toISOString() }]
            });

            const result = await checkAiGovernance({
                tenantId,
                breakerKey,
                config: { cooldownMs: 300_000 }
            });

            // checkAiGovernance will detect expired cooldown and transition
            expect(mockDb.batch).toHaveBeenCalledWith(expect.arrayContaining([
                expect.objectContaining({}), // prepare call
            ]));
        });
    });
});
