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
        ],
        coverage: {
            provider: "v8",
            include: ["src/lib/security/**", "src/lib/correlation.ts", "src/lib/api-client.ts", "src/app/layout.tsx"],
            reporter: ["text", "json", "html"],
        },
        setupFiles: ["./src/__tests__/setup.ts"],
    },
});
