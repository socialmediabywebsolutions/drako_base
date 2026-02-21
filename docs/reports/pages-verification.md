# Verificación de Despliegue Cloudflare Pages

## Estado del Repositorio
*   **Fuente de Verdad**: `wrangler.toml`
*   **Build Command**: `npm run build:worker`
*   **Output Directory**: `.open-next`
*   **Compatibilidad**: `nodejs_compat` (via `wrangler.toml` + `finalizer-worker.js` patching)

## Evidencia de Build Local (Árbol .open-next)
El script `scripts/finalize-worker.js` genera la siguiente estructura garantizada:

```
.open-next/
├── _worker.js          (Patched Entry Point)
├── open-next.config.mjs
├── middleware.mjs
└── assets/             (Static Assets)
```

## Validación Post-Deploy
Ejecutar estos comandos tras el despliegue en Cloudflare:

### 1. Health Check
```bash
curl -I https://drako-base-3.pages.dev/api/health
```
**Esperado**: `HTTP/2 200`

### 2. Home Page
```bash
curl -I https://drako-base-3.pages.dev/
```
**Esperado**: `HTTP/2 200`

### 3. API Billing (Nueva)
```bash
curl -X POST https://drako-base-3.pages.dev/api/billing/webhook
```
**Esperado**: `400 Bad Request` (Missing Signature) -> Esto confirma que el worker está corriendo y validando.

## Acciones de Limpieza Realizadas
*   Eliminado cualquier rastro de configuración de Vercel.
*   Estandarizado `package.json` para usar `build:worker`.
*   Asegurado que `finalize-worker.js` falla si no encuentra el worker generado.
