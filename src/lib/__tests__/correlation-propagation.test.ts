import { describe, it, expect, vi, beforeEach } from "vitest";
import { fetchWithCorrelation } from "../api-client";
import { headers } from "next/headers";

vi.mock("next/headers", () => ({
    headers: vi.fn(),
}));

describe("Correlation ID Propagation", () => {
    beforeEach(() => {
        vi.clearAllMocks();
        global.fetch = vi.fn().mockResolvedValue({ ok: true });
    });

    it("should attach X-Drako-Correlation-Id from headers to outgoing fetch", async () => {
        const mockHeaders = new Map([
            ["x-drako-correlation-id", "corr-test-123"],
            ["x-drako-tenant-id", "tenant-test"]
        ]);
        (headers as any).mockResolvedValue(mockHeaders);

        await fetchWithCorrelation("https://api.test.com/data");

        expect(global.fetch).toHaveBeenCalledWith(
            "https://api.test.com/data",
            expect.objectContaining({
                headers: expect.any(Headers)
            })
        );

        const callHeaders = (global.fetch as any).mock.calls[0][1].headers;
        expect(callHeaders.get("x-drako-correlation-id")).toBe("corr-test-123");
        expect(callHeaders.get("x-drako-tenant-id")).toBe("tenant-test");
    });

    it("should attach bearer token if CLOUDFLARE_WORKER_SECRET is set", async () => {
        process.env.CLOUDFLARE_WORKER_SECRET = "secret-123";
        (headers as any).mockResolvedValue(new Map());

        await fetchWithCorrelation("https://api.test.com/data");

        const callHeaders = (global.fetch as any).mock.calls[0][1].headers;
        expect(callHeaders.get("Authorization")).toBe("Bearer secret-123");
    });
});
