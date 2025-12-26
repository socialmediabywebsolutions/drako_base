# Production Internal Deploy Runbook

## 1) Preconditions
- Entorno: staging/preview/prod-internal con D1 real y routing activo.
- Roles: sesión válida con `role=admin` (owner/admin).
- Secrets requeridos (no listar valores):
  - Stripe: `STRIPE_SECRET_KEY`, `STRIPE_WEBHOOK_SECRET`, `STRIPE_PUBLISHABLE_KEY`
  - Cloudflare: `CF_API_TOKEN`, `CF_ACCOUNT_ID`, `CF_ZONE_ID` (si aplica)
  - Orchestrator: `FIREWORKS_API_KEY` (si aplica)

## 2) Migration checklist (0045 → 0055)
Aplicar en orden exacto y registrar en `drako_migrations`.

Migraciones esperadas:
- 0045_drako_empire_runtime_core
- 0046_drako_empire_runtime_constraints
- 0047_drako_domain_verification
- 0048_drako_domain_status_normalization
- 0049_drako_stripe_mapping
- 0050_drako_stripe_webhook_events
- 0051_drako_events_rollups
- 0052_drako_action_queue_operable
- 0053_drako_public_surface_security
- 0054_drako_ai_governance
- 0055_drako_migrations_state

Para cada migration:
1) Aplicar SQL en D1.
2) Registrar en `drako_migrations`:
```sql
INSERT INTO drako_migrations (id, applied_at, checksum, source)
VALUES ('0045_drako_empire_runtime_core', CURRENT_TIMESTAMP, NULL, 'manual');
```

## 3) DB health gate
Endpoint:
```
GET /api/owner/db/health
```

OK esperado:
- `status = OK`
- `missingMigrations = []`
- `driftFindings = []`

Si hay missing/drift:
- Espera Action Queue CRITICAL + evento `db.migrations.missing_detected` o `db.schema.drift_detected`.
- Corregir migraciones o drift y reintentar.

## 4) Flags matrix (staged rollout)

| Flag | Phase 0 (safe) | Phase 1 (domains) | Phase 2 (stripe live) | Phase 3 (webhooks) |
| --- | --- | --- | --- | --- |
| DRACO_PROVISIONING_ENABLED | false | true | true | true |
| DRACO_PROVISIONING_MODE | dry_run | dry_run | live | live |
| DRACO_STRIPE_LIVE_REQUIRE_CANONICAL_ACTIVE | true | true | true | true |
| DRACO_STRIPE_LIVE_OVERRIDE | false | false | false | false |
| DRACO_PUBLIC_SIGNATURE_REQUIRED | false | false | true | true |
| DRACO_RATE_LIMIT_ENABLED | true | true | true | true |
| DRACO_AI_RATE_LIMIT_ENABLED | true | true | true | true |
| DRACO_AI_RPM_PER_TENANT | 60 | 60 | 60 | 60 |
| DRACO_AI_RPM_PER_SAAS | 30 | 30 | 30 | 30 |
| DRACO_AI_MONTHLY_TOKENS_SOFT | 200000 | 200000 | 200000 | 200000 |
| DRACO_AI_MONTHLY_TOKENS_HARD | 300000 | 300000 | 300000 | 300000 |
| DRACO_AI_CB_FAILURE_THRESHOLD | 5 | 5 | 5 | 5 |
| DRACO_AI_CB_COOLDOWN_SECONDS | 300 | 300 | 300 | 300 |
| DRACO_AI_CB_HALF_OPEN_TRIALS | 2 | 2 | 2 | 2 |
| DRACO_EVENTS_RETENTION_DAYS | 30 | 30 | 30 | 30 |
| DRACO_EVENTS_CRITICAL_RETENTION_DAYS | 90 | 90 | 90 | 90 |
| DRACO_ACTIONS_HISTORY_RETENTION_DAYS | 60 | 60 | 60 | 60 |

Rollback a safe:
- `DRACO_PROVISIONING_ENABLED=false`
- `DRACO_PROVISIONING_MODE=dry_run`
- `DRACO_STRIPE_LIVE_OVERRIDE=false`
- `DRACO_PUBLIC_SIGNATURE_REQUIRED=false`

## 5) End-to-end smoke (paso a paso)

### E2E-01 Create SaaS (dry_run)
Acción:
- UI: `/saas/create` → crear SaaS (dry_run)

Expected:
- Row en `saas`
- Domain canonical en `saas_domains` status `pending`
- Provisioning plan/state creado (si aplica)

Evidencia:
- Captura UI de `/owner` (SaaS Factory)
- Snapshot D1 con el `saas_id` y `saas_domains`

Fallback:
- Revisar `campamento_events` (`factory.*`, `provision.*`)

### E2E-02 Canonical verify
Acción:
```
POST /api/owner/domains/verify
{ "scope": "saas", "saasId": "SAAS_ID" }
```

Expected:
- `saas_domains.status = active`
- `verification_status = verified`

Evidencia:
- Captura en `/owner` → Dominios
- Row D1 actualizada (`updated_at`)

Fallback:
- Revisar host resolver / wildcard routing

### E2E-03 Enable live billing
Acción:
- Set `DRACO_PROVISIONING_ENABLED=true`, `DRACO_PROVISIONING_MODE=live`
- Ejecutar flujo de provisioning/billing (factory/orchestrator)

Expected:
- `saas_stripe_mapping` creado
- Evento `billing.stripe.*` en `campamento_events`

Evidencia:
- Row en `saas_stripe_mapping`
- Evento `billing.stripe.synced`

Fallback:
- Verificar canonical ACTIVE y flags Stripe

### E2E-04 Webhook processing
Acción:
- Enviar webhook válido (Stripe test) o fixture seguro.

Expected:
- `stripe_webhook_events` con `stripe_event_id`
- Evento interno `billing.*`
- Action Queue si hay anomalía

Evidencia:
- Row en `stripe_webhook_events`
- Eventos en `campamento_events`

Fallback:
- Validar `STRIPE_WEBHOOK_SECRET` y raw body

### E2E-05 Events rollup
Acción:
```
POST /api/owner/events/rollup
```

Expected:
- `campamento_event_rollups_daily` actualizado
- Purge aplicado según retención

Evidencia:
- UI `/owner` → Eventos del Imperio

Fallback:
- Revisar envs de retención

### E2E-06 Action Queue ops
Acción:
- Selecciona una acción existente
- Ejecuta: Execute / Dismiss / Snooze
- Ejecuta cleanup

Expected:
- Status actualizado
- Retención respeta `DRACO_ACTIONS_HISTORY_RETENTION_DAYS`

Evidencia:
- UI `/owner` → Action Queue

Fallback:
- Revisar endpoint `/api/owner/actions/*`

### E2E-07 Final DB health OK
Acción:
```
GET /api/owner/db/health
```

Expected:
- `status = OK`

Evidencia:
- Respuesta JSON sin missing/drift

Fallback:
- Reaplicar migraciones faltantes

## 6) Troubleshooting quick hits
- Canonical no pasa a active → revisar wildcard routing + resolver.
- Stripe live bloqueado → canonical no active o override false.
- Webhook rechazado → firma/secret/raw body.
- Event table creciendo → ejecutar rollup + revisar retención.
- Demasiadas acciones → cleanup + dedupe `action_key`.
- Orchestrator bloqueado → circuito OPEN / limits AI.
