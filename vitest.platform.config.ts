import { defineConfig } from "vitest/config";
import path from "path";

export default defineConfig({
  test: {
    environment: "jsdom",
    globals: true,
    alias: {
      "@": path.resolve(__dirname, "./src"),
      "server-only": path.resolve(__dirname, "src/__tests__/mocks/empty.ts"),
    },
    include: [
      "tests/api/auth-cross-redirects.test.ts",
      "tests/api/campobase-platform-route.test.ts",
      "tests/api/campobase-socialflow-route.test.ts",
      "tests/api/factory-route.test.ts",
      "tests/api/legacy-saas-create-production-block.test.ts",
      "tests/api/owner-factory-actions.test.ts",
      "tests/api/owner-factory-incidents.test.ts",
      "tests/api/owner-factory-recovery.test.ts",
      "tests/api/owner-factory-retry-domain.test.ts",
      "tests/api/owner-factory-retry-job.test.ts",
      "tests/api/owner-factory-status.test.ts",
      "tests/api/owner-factory-trends.test.ts",
      "tests/api/owner-saas-factory-create-canonical.test.ts",
      "tests/api/owner-saas-factory-job-status.test.ts",
      "tests/api/stripe-webhook-signature.test.ts",
      "tests/lib/platform-surface-contract.test.ts",
      "src/__tests__/auths-isolation.test.ts",
    ],
    setupFiles: ["./src/__tests__/setup.ts"],
    pool: "forks",
    maxWorkers: 1,
    fileParallelism: false,
  },
});
