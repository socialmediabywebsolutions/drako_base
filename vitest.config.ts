import { defineConfig, configDefaults } from "vitest/config";
import path from "path";

export default defineConfig({
    esbuild: {
        jsx: "automatic",
        jsxImportSource: "react",
        tsconfigRaw: {
            compilerOptions: {
                jsx: "react-jsx",
                jsxImportSource: "react",
            },
        },
    },
    test: {
        environment: "jsdom",
        globals: true,
        alias: {
            "@": path.resolve(__dirname, "./src"),
            "@shared-neutral": path.resolve(__dirname, "./packages/shared-neutral/src"),
            "@shared-cloudflare": path.resolve(__dirname, "./packages/shared-cloudflare/src"),
            "@shared-ui-neutral": path.resolve(__dirname, "./packages/shared-ui-neutral/src"),
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
