import { defineConfig, configDefaults } from "vitest/config";
import path from "path";

export default defineConfig({
    test: {
        environment: "jsdom",
        globals: true,
        alias: {
            "@": path.resolve(__dirname, "./src"),
            "server-only": path.resolve(__dirname, "src/__tests__/mocks/empty.ts"),
        },
        exclude: [
            ...configDefaults.exclude,
            "tests/**/*.spec.ts",
            "_temp/**",
            "tests/e2e/**",
            "src/__tests__/owner-governance-alerts-route.test.ts",
            "src/__tests__/operator-governance-view.test.ts",
            "src/__tests__/owner-governance-route.test.ts",
            "src/__tests__/ui-isolation.test.tsx",
            "tests/api/billing-webhook.test.ts",
            "src/components/saas/socialflow/SocialFlowWorkspaceClient.test.tsx",
        ],
        coverage: {
            provider: "v8",
            include: ["src/lib/security/**", "src/lib/correlation.ts", "src/lib/api-client.ts", "src/app/layout.tsx"],
            reporter: ["text", "json", "html"],
        },
        setupFiles: ["./src/__tests__/setup.ts"],
        pool: "forks",
        maxWorkers: 1,
        fileParallelism: false,
    },
});
