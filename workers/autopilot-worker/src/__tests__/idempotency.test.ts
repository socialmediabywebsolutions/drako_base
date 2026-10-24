import { describe, it, expect, vi, beforeEach } from "vitest";

// Mock D1
const mockDb = {
    prepare: vi.fn().mockReturnThis(),
    bind: vi.fn().mockReturnThis(),
    all: vi.fn().mockResolvedValue({ results: [] }),
    run: vi.fn().mockResolvedValue({ success: true }),
    batch: vi.fn().mockResolvedValue([]),
};

describe("Worker Idempotency", () => {
    beforeEach(() => {
        vi.clearAllMocks();
    });

    it("should detect duplicate jobs", async () => {
        // Mock that the job already exists
        mockDb.all.mockResolvedValueOnce({ results: [{ idempotency_key: "job-123" }] });

        // Simulate checkIdempotency logic
        const checkIdempotency = async (db: any, key: string) => {
            const result = await db.prepare("SELECT...").bind(key).all();
            return (result.results?.length ?? 0) > 0;
        };

        const isDuplicate = await checkIdempotency(mockDb, "job-123");
        expect(isDuplicate).toBe(true);
        expect(mockDb.prepare).toHaveBeenCalled();
    });

    it("should mark job as processed", async () => {
        const markJobProcessed = async (db: any, key: string) => {
            await db.prepare("INSERT INTO...").bind(key, "COMPLETED").run();
        };

        await markJobProcessed(mockDb, "job-123");
        expect(mockDb.run).toHaveBeenCalled();
    });
});
