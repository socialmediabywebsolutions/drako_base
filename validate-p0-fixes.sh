#!/bin/bash
set -e

echo "=== VALIDACIÓN P0 FIXES ==="
echo ""

echo "1. Ejecutando typecheck..."
pnpm typecheck 2>&1 | head -50
echo ""

echo "2. Ejecutando lint en archivos tocados..."
pnpm lint src/lib/mentoria/acquisition-publishing.ts 2>&1 | head -30
pnpm lint src/app/api/mentoria/acquisition/route.ts 2>&1 | head -30
pnpm lint src/lib/mentoria/service.ts 2>&1 | head -30
pnpm lint src/lib/mentoria/session-persistence.ts 2>&1 | head -30
pnpm lint src/lib/socialflow/client.ts 2>&1 | head -30
echo ""

echo "3. Ejecutando tests afectados..."
pnpm test 2>&1 | head -100
echo ""

echo "=== FIN VALIDACIÓN ==="
