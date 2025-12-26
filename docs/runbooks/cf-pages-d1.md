# Cloudflare Pages + D1 Runbook

## 1) Binding DRACO_DB en Pages
- En el proyecto de Cloudflare Pages, abre *Settings → Functions → D1 bindings*.
- Añade un binding con nombre **DRACO_DB** apuntando a la base D1 que usa prod (ej. `drako_db`).
- Vuelve a desplegar para que `_worker.js` reciba el binding.

## 2) Aplicar migraciones al D1 remoto
- Autentica Wrangler si hace falta: `npx wrangler login`.
- Lanza las migraciones contra la base remota (requiere `wrangler.toml` con el `database_id`):
  ```bash
  npx wrangler d1 migrations apply DRACO_DB --remote
  ```
- Revisa el resultado: no debe quedar ninguna migración pendiente.

## 3) Validar endpoints
- Haz un build previo (opcional) para asegurarte de que `.vercel/output` está actualizado:
  ```bash
  npm run cf:build
  ```
- Arranca un preview local con D1 para probar:
  ```bash
  npm run cf:preview -- --port 8788 --persist-to .wrangler/state
  ```
- Prueba salud y agentes:
  ```bash
  curl -i http://localhost:8788/api/health
  curl -i http://localhost:8788/api/agents
  ```
  Ambos deben responder 200. Si el binding falta o hay tablas sin migrar, las APIs ahora devuelven 503 con `reason` (`binding-missing` o `migrations-missing`) y `errorId`.

## 4) Desplegar
- Cuando las migraciones estén aplicadas y los checks pasen, despliega:
  ```bash
  npm run cf:deploy
  ```
- Verifica en producción (`https://drako-base.pages.dev`) que `/api/agents`, `/api/departments`, `/api/metrics`, `/api/saas` responden 200. Si ves 503, revisa binding/migraciones como en los pasos anteriores.
