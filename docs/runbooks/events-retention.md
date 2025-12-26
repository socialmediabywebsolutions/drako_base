# Campamento Events Retention & Rollups

## Objetivo
- Mantener `campamento_events` acotado (full-fidelity solo reciente).
- Conservar CRITICAL/SECURITY mas tiempo.
- Crear rollups diarios para tendencias rapidas.

## Variables de entorno
- `DRACO_EVENTS_RETENTION_DAYS` (default 30)
- `DRACO_EVENTS_CRITICAL_RETENTION_DAYS` (default 90)

## Ejecutar rollup + retencion (manual)
Endpoint interno:
- `POST /api/owner/events/rollup`
- Requiere session admin + tenant valido.

Respuesta esperada:
```json
{
  "ok": true,
  "result": {
    "rollupCount": 12,
    "purgedCount": 140,
    "purgedCriticalCount": 0,
    "retentionDays": 30,
    "criticalRetentionDays": 90
  }
}
```

## Verificar rollups
Consulta:
```
SELECT * FROM campamento_event_rollups_daily
WHERE tenant_id = ?
ORDER BY day DESC;
```

## Verificar purga
Consulta:
```
SELECT COUNT(*) FROM campamento_events
WHERE tenant_id = ? AND created_at < ?;
```

## Recuperacion (si se borra demasiado)
1) Ajusta `DRACO_EVENTS_RETENTION_DAYS` y `DRACO_EVENTS_CRITICAL_RETENTION_DAYS`.
2) Deten el job si es necesario.
3) Restaura desde backups (si los hay) y re-ejecuta rollup.
