#!/usr/bin/env bash
set -euo pipefail

saases=(
  "drakos:drakos.drako.systems"
  "mentorias:mentoria.drako.systems"
  "bases:bases.drako.systems"
  "socialflows:socialflows.drako.systems"
  "cryptos:cryptos.drako.systems"
  "invoices:invoices.drako.systems"
  "analytics:analytics.drako.systems"
  "automations:automations.drako.systems"
)

curl_with_retries() {
  local url="$1"
  shift
  curl -4 -sS \
    --retry 8 \
    --retry-delay 1 \
    --retry-all-errors \
    --connect-timeout 5 \
    --max-time 20 \
    "$url" "$@"
}

echo "== Health checks =="
for item in "${saases[@]}"; do
  slug="${item%%:*}"
  domain="${item##*:}"
  echo "-- ${slug} (${domain})"
  health_payload="$(curl_with_retries "https://${domain}/api/health" || true)"
  if command -v jq >/dev/null 2>&1; then
    printf '%s' "$health_payload" | jq '{ok,host,resolvedContext,workerName,gitSha,workersOnly}'
  else
    echo "$health_payload"
  fi
  echo

done

echo "== Host fencing checks (expected 403) =="
for item in "${saases[@]}"; do
  slug="${item%%:*}"
  domain="${item##*:}"
  echo "-- ${slug} rejecting foreign Host header"
  fence_status="$(curl_with_retries "https://${domain}/api/health" -i -H 'Host: invalid.drako.systems' | head -n 1 || true)"
  echo "${fence_status}"
  echo

done
