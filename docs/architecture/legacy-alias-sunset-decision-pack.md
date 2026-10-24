# Legacy Alias Sunset Decision Pack (P0.8)

## Resumen Ejecutivo
Este paquete consolida la decisión de sunset para aliases legacy sin cortar rutas todavía.  
Estado global actual: `LEGACY_ALIAS_SUNSET_DECISION_NO_DATA`.

## Estado Actual
- Aliases evaluados: `50`
- Owner aliases: `48`
- Campobase aliases: `2`
- Clasificación:
  - `KEEP_COMPAT`: `2`
  - `READY_FOR_OBSERVATION`: `48`
  - `READY_FOR_MIGRATION`: `0`
  - `READY_FOR_CUT_REQUIRES_APPROVAL`: `0`
  - `BLOCKED`: `0`
- Guardrails:
  - `readyForCut=false`
  - `requiresHumanApproval=true`

## Por Qué No Cortar Todavía
- No hay ventana de observación con datos reales suficientes (`NO_DATA`).
- Faltan artefactos operativos previos al corte:
  - rollback path validado;
  - monitoring activo con evidencia;
  - aprobación humana registrada.

## Tabla de Aliases
| Alias | Inventario | Canonical Target | Clase P0.8 | Decisión |
|---|---:|---|---|---|
| `/api/owner/**` | 48 rutas | `/api/operator/**` y `/api/factory/**` (según ruta) | `READY_FOR_OBSERVATION` | mantener compat + observación |
| `/api/campobase/platform` | 1 ruta | `/api/operator/platform` | `KEEP_COMPAT` | mantener compat |
| `/api/campobase/socialflow` | 1 ruta | `/api/operator/socialflow` | `KEEP_COMPAT` | mantener compat |

Inventario exacto por ruta: `docs/config/legacy-alias-deprecation-matrix.json`.

## Blockers
- `ROLLBACK_PATH_MISSING`
- `MONITORING_NOT_ACTIVE`
- `OBSERVATION_WINDOW_INCOMPLETE`
- `HUMAN_APPROVAL_NOT_RECORDED`

## Checklist de Aprobación Humana
- Aprobador humano asignado y registrado.
- Evidencia de ventana de observación adjunta.
- Evidencia de migración de callers adjunta.
- Checklist de rollback validado.
- Dashboards y alertas de monitoring confirmados.

## Checklist de Rollback
- Snapshot de inventario legacy actualizado.
- Plan de restauración por alias (re-export/proxy) listo.
- Health checks canónicos antes/después del cambio.
- Cutover en ventana controlada/canary.
- Runbook de restore y owner on-call definidos.

## Decisión Global
`KEEP_COMPAT` hasta cerrar observación real + prerequisitos operativos.  
No se autoriza corte en P0.8.

## Siguiente Paso Recomendado
Ejecutar ventana de observación real y preparar aprobación para P0.9 con rollback y monitoreo verificados.
