#!/usr/bin/env bash
set -euo pipefail

saases=(
  "drakos:drakos.drako.systems"
  "mentorias:mentorias.drako.systems"
  "bases:bases.drako.systems"
  "socialflows:socialflows.drako.systems"
  "cryptos:cryptos.drako.systems"
  "invoices:invoices.drako.systems"
  "analytics:analytics.drako.systems"
  "automations:automations.drako.systems"
)

echo "== Health checks =="
for item in "${saases[@]}"; do
  slug="${item%%:*}"
  domain="${item##*:}"
  echo "-- ${slug} (${domain})"
  curl -sS "https://${domain}/api/health" | jq '{ok,host,resolvedContext,workerName,gitSha,workersOnly}'
  echo

done

echo "== Host fencing checks (expected 403) =="
for item in "${saases[@]}"; do
  slug="${item%%:*}"
  domain="${item##*:}"
  echo "-- ${slug} rejecting foreign Host header"
  curl -sS -i "https://${domain}/api/health" -H 'Host: invalid.drako.systems' | head -n 1
  echo

done
