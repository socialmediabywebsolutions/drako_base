import { vi } from "vitest";

vi.mock("server-only", () => ({}));

// Mock Cloudflare Bindings
export const mockDb = {
    prepare: vi.fn().mockReturnThis(),
    bind: vi.fn().mockReturnThis(),
    all: vi.fn().mockResolvedValue({ results: [] }),
    run: vi.fn().mockResolvedValue({ success: true }),
    batch: vi.fn().mockResolvedValue([]),
};

vi.mock("@/lib/cf", () => ({
    env: vi.fn().mockReturnValue({
        DRACO_DB: mockDb,
        DRACO_RATE_LIMIT_ENABLED: "true",
    }),
}));

// Mock Next.js headers
vi.mock("next/headers", () => ({
    headers: vi.fn().mockResolvedValue(new Map()),
}));

// Mock global fetch for API client tests
global.fetch = vi.fn();

import "@testing-library/jest-dom/vitest";
