#!/bin/bash
set -euo pipefail

echo "=== VALIDACIÓN P0-1C MENTORÍA ACQUISITION ==="
echo ""

echo "1. Typecheck"
pnpm typecheck

echo ""
echo "2. Targeted tests (P0-1C)"
npx vitest run \
  tests/api/mentoria-acquisition-feature-flag.test.ts \
  tests/lib/mentoria-acquisition-tenant-isolation.test.ts \
  tests/api/mentoria-production-flow.test.ts

echo ""
echo "3. Full test suite"
pnpm test

echo ""
echo "4. Build"
pnpm build

echo ""
echo "5. Git diff check"
git diff --check

echo ""
echo "=== FIN VALIDACIÓN P0-1C ==="
