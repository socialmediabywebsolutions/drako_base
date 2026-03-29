#!/usr/bin/env bash
set -euo pipefail

cd /home/drako/workspace/drako_base

SECRET="${1:-${INTERNAL_API_SECRET_VALUE:-}}"
if [[ -z "$SECRET" ]]; then
  echo "usage: $0 <secret>" >&2
  exit 1
fi

for cfg in \
  workers/drako-scheduler/wrangler.workers.toml \
  workers/mentorias/wrangler.workers.toml \
  workers/drakos/wrangler.workers.toml \
  workers/bases/wrangler.workers.toml
do
  printf '%s' "$SECRET" | npx wrangler secret put INTERNAL_API_SECRET --config "$cfg"
done
