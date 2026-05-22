#!/usr/bin/env bash
set -euo pipefail

cd /home/drako/workspace/drako_base

if [ -z "${SOCIALFLOW_CANARY_GATE_TOKEN:-}" ]; then
  echo "GATE_TOKEN_ENV_MISSING"
  exit 2
fi

GATE_TOKEN="${SOCIALFLOW_CANARY_GATE_TOKEN}"

# 1) Execute rehardening endpoint (token never printed)
curl -sS -i -X POST \
  -H "x-socialflow-canary-gate: ${GATE_TOKEN}" \
  https://socialflow-canary.drako.systems/api/socialflow/runtime/reharden \
  > /tmp/p2_28_reharden_http.txt

head -n 1 /tmp/p2_28_reharden_http.txt | tr -d '\r'

python3 - <<'PY'
import json
from pathlib import Path

raw = Path("/tmp/p2_28_reharden_http.txt").read_text(errors="ignore")
if "\r\n\r\n" in raw:
    body = raw.split("\r\n\r\n", 1)[1]
elif "\n\n" in raw:
    body = raw.split("\n\n", 1)[1]
else:
    body = ""

try:
    data = json.loads(body)
    print("REHARDEN_JSON_PARSE=1")
    for key in ("success", "updated", "reason", "code"):
        if key in data:
            print("REHARDEN_{}={}".format(key.upper(), data[key]))
    status = data.get("status") or data.get("changes")
    if isinstance(status, dict):
        if "accessToken" in status:
            print("REHARDEN_ACCESS_TOKEN_STATUS={}".format(status["accessToken"]))
        if "idToken" in status:
            print("REHARDEN_ID_TOKEN_STATUS={}".format(status["idToken"]))
except Exception:
    print("REHARDEN_JSON_PARSE=0")
PY

# 2) Minimal D1 safe verification (no SELECT *, no full auth_meta, no token values)
SQL=$(cat <<'SQLEND'
SELECT
  tenant_id,
  saas_id,
  provider,
  status,
  CASE
    WHEN json_type(auth_meta, '$.accessToken')='text'
      THEN CASE WHEN json_extract(auth_meta, '$.accessToken') LIKE 'encrypted:v1:aes-gcm:%' THEN 1 ELSE 0 END
    ELSE NULL
  END AS access_token_encrypted,
  CASE
    WHEN json_type(auth_meta, '$.idToken')='text'
      THEN CASE WHEN json_extract(auth_meta, '$.idToken') LIKE 'encrypted:v1:aes-gcm:%' THEN 1 ELSE 0 END
    ELSE NULL
  END AS id_token_encrypted,
  CASE WHEN json_type(auth_meta, '$.accessToken')='text' THEN 1 ELSE 0 END AS access_token_present,
  CASE WHEN json_type(auth_meta, '$.idToken')='text' THEN 1 ELSE 0 END AS id_token_present
FROM saas_social_accounts
WHERE tenant_id='tenant_socialflow_canary_staff'
  AND saas_id='p2-24i-saas'
  AND provider='LINKEDIN'
ORDER BY created_at DESC
LIMIT 1;
SQLEND
)

pnpm --dir apps/socialflow-runtime exec wrangler d1 execute SOCIAL_DB \
  --config wrangler.toml \
  --remote \
  --command "$SQL" \
  --json > /tmp/p2_28_d1_safe.json

python3 - <<'PY'
import json

obj = json.load(open("/tmp/p2_28_d1_safe.json"))
rows = []
if isinstance(obj, list) and obj and isinstance(obj[0], dict):
    rows = obj[0].get("results") or []

print("D1_ROW_COUNT={}".format(len(rows)))
if rows:
    row = rows[0]
    keys = [
        "tenant_id",
        "saas_id",
        "provider",
        "status",
        "access_token_present",
        "id_token_present",
        "access_token_encrypted",
        "id_token_encrypted",
    ]
    for key in keys:
        print("D1_{}={}".format(key.upper(), row.get(key)))
PY

# 3) Health and readiness with gate
curl -sS -i \
  -H "x-socialflow-canary-gate: ${GATE_TOKEN}" \
  https://socialflow-canary.drako.systems/api/socialflow/runtime/health \
  > /tmp/p2_28_health_http.txt

curl -sS -i \
  -H "x-socialflow-canary-gate: ${GATE_TOKEN}" \
  https://socialflow-canary.drako.systems/api/socialflow/runtime/readiness \
  > /tmp/p2_28_readiness_http.txt

echo "HEALTH_STATUS=$(head -n 1 /tmp/p2_28_health_http.txt | tr -d '\r')"
echo "READINESS_STATUS=$(head -n 1 /tmp/p2_28_readiness_http.txt | tr -d '\r')"
