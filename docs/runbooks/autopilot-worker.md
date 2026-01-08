# Autopilot Worker Runbook

## Propósito
Procesa la cola `autopilot_queue` para automatizar la verificación y activación de dominios personalizados. Emite eventos a `campamento_events` y mantiene el estado en `saas_domains`.

## Entrypoints
- **Queue consumer**: `src/index.ts` (`queue()`)
- **Cron**: `src/index.ts` (`scheduled()`), usado para resetear el circuito si estuvo abierto.

## Recursos y Bindings
| Binding | Tipo | Notas |
| --- | --- | --- |
| `DRACO_DB` | D1Database | Requerido para leer/escribir en `saas_domains` y `campamento_events`. |
| `AUTOPILOT_QUEUE` | Queue | Cola primaria con mensajes `domains.hostname.*`. |
| `AUTOPILOT_DLQ` | Queue (opcional) | Dead-letter para fallos permanentes. |
| `APP_URL` | String | URL base del sitio (debug/logs). |

## Configuración local
1. Copiar `.dev.vars.example` a `.dev.vars` y completar bindings reales.
2. Ejecutar `wrangler d1 execute` para aplicar migraciones si es necesario.
3. Lanzar worker en modo dev:
   ```bash
   npm install
   npx wrangler dev --env autopilot-worker
   ```

## Despliegue
```bash
npx wrangler deploy --env autopilot-worker
```
Asegurarse de que:
- La queue `autopilot_queue` exista y esté conectada.
- `AUTOPILOT_DLQ` esté configurada en producción.

## Observabilidad
- Eventos en `campamento_events` (`domains.hostname.*`, `routing.resolve.*`).
- Logs de Wrangler (`wrangler tail --env autopilot-worker`).
- Métricas de reintentos: verificar `retry_count` y `last_checked_at` en `saas_domains`.

## Seguridad
- Mantener `AUTOPILOT_WORKER_API_TOKEN` rotado y con privilegios mínimos.
- `DRACO_DB` debe limitarse a consultas necesarias via worker.
- Validar payloads de cola antes de operar (ya se realiza en `processHostnameMessage`).
