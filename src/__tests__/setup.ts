import { vi } from "vitest";

vi.mock("server-only", () => ({}));

// Mock Next.js headers
vi.mock("next/headers", () => ({
    headers: vi.fn().mockResolvedValue(new Map()),
}));

// Mock global fetch for API client tests
global.fetch = vi.fn();

import "@testing-library/jest-dom/vitest";
