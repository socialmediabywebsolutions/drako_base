#!/usr/bin/env bash
# ─────────────────────────────────────────────────────────────────────────────
# deploy-with-db.sh
# Crea la D1, aplica la migración y despliega el worker de socialcors-landing
# Ejecutar desde el raíz del monorepo:  bash apps/socialcors-landing/deploy-with-db.sh
# ─────────────────────────────────────────────────────────────────────────────
set -euo pipefail
WRANGLER="./node_modules/.bin/wrangler"
TOML="apps/socialcors-landing/wrangler.toml"
DB_NAME="socialcors-landing-db"

echo "──────────────────────────────────────"
echo " 1/4  Creando base de datos D1..."
echo "──────────────────────────────────────"
DB_JSON=$("$WRANGLER" d1 create "$DB_NAME" --json 2>/dev/null || true)

# Si ya existe, extraer el ID de la lista
if [ -z "$DB_JSON" ] || ! echo "$DB_JSON" | python3 -c "import sys,json; json.load(sys.stdin)" 2>/dev/null; then
  echo "  ⚠️  La DB puede ya existir. Buscando el ID..."
  DB_JSON=$("$WRANGLER" d1 list --json 2>/dev/null | python3 -c "
import sys, json
dbs = json.load(sys.stdin)
match = [d for d in dbs if d.get('name') == '$DB_NAME']
if match: print(json.dumps(match[0]))
" 2>/dev/null || echo "")
fi

DB_ID=$(echo "$DB_JSON" | python3 -c "import sys,json; d=json.load(sys.stdin); print(d.get('uuid') or d.get('id',''))" 2>/dev/null || echo "")

if [ -z "$DB_ID" ]; then
  echo "  ❌ No se pudo obtener el database_id. Revisa manualmente con:"
  echo "     $WRANGLER d1 list"
  echo "  Luego edita apps/socialcors-landing/wrangler.toml y sustituye DATABASE_ID_PLACEHOLDER"
  exit 1
fi

echo "  ✅ database_id: $DB_ID"

echo "──────────────────────────────────────"
echo " 2/4  Inyectando ID en wrangler.toml..."
echo "──────────────────────────────────────"
sed -i "s/DATABASE_ID_PLACEHOLDER/$DB_ID/" "$TOML"
echo "  ✅ wrangler.toml actualizado"

echo "──────────────────────────────────────"
echo " 3/4  Aplicando migración SQL (remoto)..."
echo "──────────────────────────────────────"
"$WRANGLER" d1 execute "$DB_NAME" --remote \
  --file="apps/socialcors-landing/migrations/0001_leads.sql"
echo "  ✅ Tabla leads creada"

echo "──────────────────────────────────────"
echo " 4/4  Desplegando worker..."
echo "──────────────────────────────────────"
"$WRANGLER" deploy --config "$TOML"
echo "  ✅ Desplegado"

echo ""
echo "✅ Todo listo. El formulario de socialcors.com ya guarda leads en D1."
echo ""
echo "Para consultar los leads:"
echo "  $WRANGLER d1 execute $DB_NAME --remote --command \"SELECT * FROM leads ORDER BY created_at DESC LIMIT 50\""
