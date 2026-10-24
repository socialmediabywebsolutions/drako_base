import { vi } from "vitest";

// Mock @/lib/cf FIRST
vi.mock("@/lib/cf", () => ({
  env: () => ({
    DRACO_DB: {} as D1Database,
    SESSION_SECRET: "test-session-secret-32chars-min",
  }),
  setGlobalEnv: vi.fn(),
}));

vi.mock("server-only", () => ({}));

// Mock Next.js headers
vi.mock("next/headers", () => ({
    headers: vi.fn().mockResolvedValue(new Map()),
}));

// Mock global fetch for API client tests
global.fetch = vi.fn();

import "@testing-library/jest-dom/vitest";
