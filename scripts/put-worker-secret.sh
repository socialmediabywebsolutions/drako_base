#!/usr/bin/env bash
set -euo pipefail

cd /home/drako/workspace/drako_base

CONFIG_PATH="${1:-}"
SECRET_KEY="${2:-}"
SECRET_VALUE="${3:-${WORKER_SECRET_VALUE:-}}"

if [[ -z "$CONFIG_PATH" || -z "$SECRET_KEY" || -z "$SECRET_VALUE" ]]; then
  echo "usage: $0 <config-path> <secret-key> <secret-value>" >&2
  exit 1
fi

printf '%s' "$SECRET_VALUE" | npx wrangler secret put "$SECRET_KEY" --config "$CONFIG_PATH"
