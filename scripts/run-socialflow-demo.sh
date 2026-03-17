#!/usr/bin/env bash
set -euo pipefail

ROOT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")/.." && pwd)"
DEMO_FILE="$ROOT_DIR/.demo/socialflow-demo.json"

cd "$ROOT_DIR"

pnpm tsx scripts/seed-socialflow-demo.ts --out="$DEMO_FILE"

export DRAKO_DEMO_MODE=true
export DRAKO_ENABLE_DEMO_SESSION=1
export DRAKO_CLIENT_DEMO_TENANT_ID=demo-tenant
export DRAKO_SOCIALFLOW_DEMO_STATE="$(cat "$DEMO_FILE")"

pnpm dev
