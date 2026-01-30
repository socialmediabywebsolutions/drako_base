# Cloudflare Workers + OpenNext Runbook

## 1) Entorno de Ejecución: Workers
Este proyecto utiliza **OpenNext** con el adaptador de Cloudflare para ejecutarse como un **Worker**. Esto elimina la dependencia de Cloudflare Pages Functions y permite un control más granular.

## 2) Configuración de Bindings (wrangler.toml)
Los bindings se gestionan directamente en el `wrangler.toml`:
- **DRACO_DB**: Binding para la base de datos D1.
- **AI**: Binding para Workers AI.

```toml
[[d1_databases]]
binding = "DRACO_DB"
database_name = "drako_db_prod"
database_id = "5607a76a-97c7-45a9-a948-e545ba27eae7"
```

## 3) Comandos de Build y Deploy
- **Build**: `npm run build:worker`
  - Esto genera la carpeta `.open-next/` con el `worker.js`.
- **Deploy**: `npm run deploy`
  - Ejecuta `wrangler deploy` usando la configuración de `wrangler.toml`.

## 4) Verificación de Bindings
Tras el despliegue, verifica los siguientes endpoints:
- `/api/health`: Debe reportar `ok: true`.
- `/api/debug/bindings`: Debe mostrar `isWorkers: true` y `hasDracoDb: true`.

## 5) Variables de Entorno (Secrets)
Para setear secretos en el Worker:
```bash
npx wrangler secret put SESSION_SECRET
npx wrangler secret put STRIPE_SECRET_KEY
```

🚀 **Drako is now Cloudflare-first.**
