# SocialFlow Production Controlled Execution

## 1. Resumen ejecutivo
Este runbook define la ejecución controlada hacia producción para SocialFlow sin autorizar deploy en esta fase. El objetivo es dejar checklist, evidencia y bloqueos claros para que la ventana productiva futura sea segura y auditable.

## 2. Estado actual
- Artefactos productivos base presentes.
- `missingArtifacts=[]` para el set P1.0/P1.1.
- `readyForExecution=false`.
- `executionAllowed=false`.
- `commandsArePlannedOnly=true`.
- `requiresHumanApproval=true`.

## 3. Qué ya está listo
- `apps/socialflow-runtime/wrangler.production.toml` como template seguro.
- Smokes productivos read-only (`health`, `readiness`, `postdeploy`).
- Monitor productivo day-1 read-only.
- Plan de ejecución bloqueado por diseño.
- Approval pack para aprobación de planificación.

## 4. Qué sigue bloqueado
- Configuración manual productiva validada y aprobada.
- DNS/routing productivo aprobado.
- Validación operativa de rollback.
- Monitoring real en producción activo.
- Aprobación humana formal (stakeholder + TL + on-call + ventana).

## 5. Checklist manual de configuración
- Confirmar bindings D1 productivos finales en `wrangler.production.toml`.
- Confirmar secrets reales en Cloudflare (sin exponer valores).
- Confirmar namespace de cookies/sesiones productivas.
- Confirmar flags de ejecución manual (sin auto-activación).
- Ejecutar `pnpm tsx scripts/check-socialflow-production-manual-config.ts --json` y archivar evidencia.
- Verificar que variables requeridas estén `PRESENT` y valores `REDACTED`.

## 6. Checklist DNS/routing
- Confirmar hostname canónico productivo aprobado.
- Confirmar route mapping final al worker productivo.
- Confirmar que canary/compat no rompen rutas activas.
- Confirmar ventana de cambio DNS.

## 7. Checklist secrets/env/manual config
- Secrets cargados y rotación vigente.
- Variables de entorno productivas aprobadas por revisión humana.
- Ningún placeholder `REQUIRED_MANUAL_CONFIGURATION` remanente.
- Evidencia de revisión de configuración archivada.

## 8. Checklist pre-deploy
- `pnpm tsx scripts/check-socialflow-production-safety-gate.ts`.
- `pnpm tsx scripts/check-socialflow-route-dns-readiness.ts`.
- `pnpm tsx scripts/check-socialflow-production-cutover-readiness.ts`.
- `pnpm tsx scripts/prepare-socialflow-production-approval-pack.ts --json`.
- `pnpm tsx scripts/plan-socialflow-production-execution.ts --json`.

## 9. Checklist de smokes
- `pnpm tsx scripts/smoke-socialflow-production-health.ts --json`.
- `pnpm tsx scripts/smoke-socialflow-production-readiness.ts --json`.
- `pnpm tsx scripts/smoke-socialflow-production-postdeploy.ts --json`.
- Confirmar `tokenLeakageDetected=false`.
- Confirmar `remoteWrites=0`.

## 10. Checklist de monitoring
- `pnpm tsx scripts/monitor-socialflow-production-day.ts --day=1 --json`.
- `pnpm tsx scripts/check-socialflow-production-window-readiness.ts --json`.
- Confirmar `readyForCutover=false` (hasta aprobación final).
- Confirmar `requiresHumanApproval=true`.
- Confirmar dashboards/alertas operativas habilitadas.

## 11. Checklist de rollback
- Comando de rollback documentado y revisado.
- Owner de rollback asignado.
- `rollback plan id` validado por `check-socialflow-production-rollback-readiness`.
- `restore path` documentado y revisado (sin ejecutar rollback real).
- Política DB expand/contract validada.
- Drill de rollback reciente documentado.

## 12. Checklist de aprobación humana
- Aprobación stakeholder.
- Aprobación technical lead.
- On-call asignado para la ventana.
- Ventana productiva confirmada.
- Approval ID, Window ID y Rollback Plan ID definidos y validados (sin exponer valores).

## 13. Comandos planned-only
- `pnpm tsx scripts/check-socialflow-production-manual-config.ts`.
- `pnpm tsx scripts/check-socialflow-production-rollback-readiness.ts`.
- `pnpm tsx scripts/check-socialflow-production-window-readiness.ts`.
- `wrangler deploy --config apps/socialflow-runtime/wrangler.production.toml`.
- `wrangler rollback --config apps/socialflow-runtime/wrangler.production.toml`.
- Cualquier comando de cambio DNS/rutas productivas.

## 14. Comandos que NO deben ejecutarse todavía
- Deploy real a producción.
- Rollback real en producción.
- Cambios DNS/routing productivo.
- Migraciones/escrituras D1 remotas.

## 15. Condiciones para pasar a ejecución
- Aprobaciones humanas completas.
- DNS/routing productivo listo y aprobado.
- Configuración manual cerrada sin placeholders.
- Rollback validado operativamente.
- Monitoring real activo.
- `executionAllowed=true` solo tras aprobación explícita fuera de esta fase.

## 16. Condiciones de abort
- Cualquier señal de token leakage.
- Cualquier evidencia de remote writes inesperadas.
- Drift de configuración o rutas.
- Falta de on-call o ventana aprobada.
- Falla de `check-socialflow-production-window-readiness`.
- Falla de `check-socialflow-production-rollback-readiness`.

## 17. Plan de rollback
- Activar rollback command aprobado.
- Verificar safety gate post-rollback.
- Comunicar incidente y estado.
- Registrar evidencia de recuperación.

## 18. Plan postdeploy
- Smokes productivos controlados.
- Monitoring intensivo day-1/day-7.
- Seguimiento de latencia/error/backlog.
- Registro de decisiones y hallazgos.

## 19. Evidencia requerida
- Output JSON de approval pack.
- Output JSON de execution plan.
- Output JSON de smokes/monitor.
- Output JSON de `check-socialflow-production-manual-config`.
- Output JSON de `check-socialflow-production-rollback-readiness`.
- Output JSON de `check-socialflow-production-window-readiness`.
- Checklist firmada de aprobaciones/ventana/on-call.
- Evidencia de rollback readiness.

## 20. Decisión final
No deploy todavía. Este runbook no autoriza producción y mantiene ejecución bloqueada hasta aprobación humana separada en ventana aprobada.

## 21. Modo fixture local P1.3
- Este runbook admite un fixture local de aprobacion planificada para revisar el flujo sin tocar produccion.
- Ejecutar con `--fixture=tests/fixtures/socialflow-production-planned-approval.json` o con `SOCIALFLOW_PRODUCTION_PLANNED_APPROVAL_FIXTURE`.
- El fixture usa `example.invalid` y debe seguir siendo `planned-only`.
- En fixture mode, los validadores marcan `fixtureMode=true` y `productionTouchAllowed=false`.
- La salida debe seguir redacatada: valores de review en `FIXTURE` o `REDACTED`, nunca secretos reales.
- Este modo solo sirve para auditoria y pruebas locales; no habilita deploy, DNS, D1, rollback real ni monitoring productivo.
- Para avanzar a una fase siguiente, primero debe mantenerse el resultado planned-only en fixture y luego cargar metadatos humanos reales fuera de fixture.
