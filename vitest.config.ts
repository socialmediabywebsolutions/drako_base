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
        alias: [
            // Rutas de SocialCors movidas a apps/socialcors (P3). Deben ir antes que "@".
            // api/socialflow/sso-init se queda en el monolito.
            {
                find: /^@\/app\/(socialflows?|api\/socialflow(?!\/sso-init)|api\/cron\/social|api\/internal\/socialflow|api\/social|auth\/linkedin|privacidad\/datos-eliminados)(?=\/|$)/,
                replacement: path.resolve(__dirname, "./apps/socialcors/src/app") + "/$1",
            },
            { find: "@", replacement: path.resolve(__dirname, "./src") },
            { find: "@shared-neutral", replacement: path.resolve(__dirname, "./packages/shared-neutral/src") },
            { find: "@shared-cloudflare", replacement: path.resolve(__dirname, "./packages/shared-cloudflare/src") },
            { find: "@shared-ui-neutral", replacement: path.resolve(__dirname, "./packages/shared-ui-neutral/src") },
            { find: "server-only", replacement: path.resolve(__dirname, "src/__tests__/mocks/empty.ts") },
        ],
        exclude: [
            ...configDefaults.exclude,
            "tests/**/*.spec.ts",
            "_temp/**",
            "tests/e2e/**",
            "src/__tests__/owner-governance-alerts-route.test.ts",
            "src/__tests__/operator-governance-view.test.ts",
            "src/__tests__/owner-governance-route.test.ts",
            "src/__tests__/ui-isolation.test.tsx",
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
