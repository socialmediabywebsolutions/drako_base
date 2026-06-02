# SocialFlow Production Approval Pack

## Estado del approval pack
- Approval scope: `APPROVAL_FOR_PLANNING_ONLY`.
- `readyForExecution=false`.
- `executionAllowed=false`.
- `commandsArePlannedOnly=true`.
- `requiresHumanApproval=true`.

## Readiness por categoría
- Artefactos: `missingArtifacts=[]`.
- Template productivo: presente, con `manualConfigurationRequired=true`.
- DNS/routing productivo: requerido para ejecución (`dnsRoutingRequired=true`).
- Rollback: requerido para ejecución (`rollbackRequired=true`).
- Monitoring: requerido para ejecución (`monitoringRequired=true`).
- Aprobación humana: requerida (`humanApprovalRequired=true`).
- Manual config validator: `scripts/check-socialflow-production-manual-config.ts` (planned-only).
- Rollback validator: `scripts/check-socialflow-production-rollback-readiness.ts` (planned-only).
- Window validator: `scripts/check-socialflow-production-window-readiness.ts` (planned-only).

## Blockers
- `MANUAL_CONFIGURATION_REQUIRED_FOR_EXECUTION`.
- `MANUAL_CONFIG_REVIEW_NOT_READY`.
- `DNS_ROUTING_REQUIRED_FOR_EXECUTION`.
- `ROLLBACK_VALIDATION_REQUIRED_FOR_EXECUTION`.
- `ROLLBACK_REVIEW_NOT_READY`.
- `PRODUCTION_MONITORING_REQUIRED_FOR_EXECUTION`.
- `PRODUCTION_WINDOW_REVIEW_NOT_READY`.
- `HUMAN_APPROVAL_REQUIRED_FOR_EXECUTION`.
- `ON_CALL_REQUIRED_FOR_EXECUTION`.
- `PRODUCTION_WINDOW_REQUIRED_FOR_EXECUTION`.

## Missing artifacts
- `[]`.

## Confirmaciones obligatorias
- `readyForExecution=false`.
- `executionAllowed=false`.
- `commandsArePlannedOnly=true`.
- `requiresHumanApproval=true`.
- `manualConfigurationRequired=true`.
- `dnsRoutingRequired=true`.
- `rollbackRequired=true`.
- `monitoringRequired=true`.
- manual config/rollback/window validators deben permanecer `planned-only` y sin exponer valores.

## Next action
Completar configuración manual, DNS/routing, validación de rollback, monitoring real y aprobaciones humanas; mantener no-deploy hasta ventana aprobada separada.

## P1.3 Fixture local planned-only
- El approval pack admite un fixture local para revisar el flujo sin tocar produccion.
- Ejecutar con `--fixture=tests/fixtures/socialflow-production-planned-approval.json` o con `SOCIALFLOW_PRODUCTION_PLANNED_APPROVAL_FIXTURE`.
- El fixture usa `example.invalid` y mantiene `fixtureMode=true` y `productionTouchAllowed=false`.
- En fixture mode, los campos de review deben mostrarse como `FIXTURE` o `REDACTED`, nunca como valores reales.
- Este modo solo sirve para auditoria y pruebas locales; no habilita deploy, DNS, D1, rollback real ni monitoring productivo.
- La siguiente fase solo se habilita cuando el fixture siga pasando y luego se sustituyan por metadatos humanos reales fuera de fixture.
