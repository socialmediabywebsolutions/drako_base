# Action Queue Runbook

## Dedupe (action_key)
- Cada accion tiene `action_key` estable: `CATEGORY:saas_id:title` (lowercase).
- Si llega una accion con el mismo `action_key` y hay una `OPEN`, se reusa:
  - actualiza `last_seen_at` y `seen_count`
  - puede elevar prioridad si la nueva es mayor
- No se crean duplicados OPEN.

## Estados
- `OPEN`: pendiente
- `EXECUTED`: ejecutada
- `DISMISSED`: descartada
- `SNOOZED`: pospuesta (con `snoozed_until`)

## Operaciones
Endpoints admin:
- `POST /api/owner/actions/{id}/execute`
- `POST /api/owner/actions/{id}/dismiss`
- `POST /api/owner/actions/{id}/snooze` (body opcional `{ "snoozedUntil": "ISO" }`)

Cada cambio emite eventos:
- `autopilot.action.proposed`
- `autopilot.action.executed`
- `autopilot.action.dismissed`
- `autopilot.action.snoozed`

## Limpiar historial
- `POST /api/owner/actions/cleanup`
- Retiene solo `OPEN`; purga `EXECUTED|DISMISSED|SNOOZED` mas antiguos que:
  - `DRACO_ACTIONS_HISTORY_RETENTION_DAYS` (default 60)

## Depurar duplicados
Consulta:
```
SELECT action_key, status, COUNT(*)
FROM campamento_actions
WHERE tenant_id = ?
GROUP BY action_key, status
HAVING COUNT(*) > 1;
```
