import { globalIgnores } from "eslint/config";
import { FlatCompat } from "@eslint/eslintrc";
import path from "node:path";
import { fileURLToPath } from "node:url";

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);
const compat = new FlatCompat({ baseDirectory: __dirname });

const config = [
  // Cargar configuraciones legacy de Next con compat para ESLint v9 (flat config).
  ...compat.extends("eslint-config-next/core-web-vitals"),
  ...compat.extends("eslint-config-next/typescript"),
  globalIgnores([
    // Default ignores of eslint-config-next:
    ".next/**",
    "out/**",
    "build/**",
    "next-env.d.ts",
    // Evitar lint sobre dependencias y artefactos externos.
    "node_modules/**",
    ".vercel/**",
    ".wrangler/**",
    "**/*.log",
    "scripts/.dist/**",
    "scripts/register-paths.js",
  ]),
];

export default config;
