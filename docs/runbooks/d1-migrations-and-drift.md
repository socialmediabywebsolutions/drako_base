# D1 Migrations and Drift Runbook

## Objetivo
Asegurar que D1 está actualizado con las migraciones esperadas y sin drift de schema.

## Aplicar migraciones
1) Ejecuta las migraciones en orden desde `/migrations`.
2) Inserta el registro en `drako_migrations` por cada migración aplicada:
```sql
INSERT INTO drako_migrations (id, applied_at, checksum, source)
VALUES ('0055_drako_migrations_state', CURRENT_TIMESTAMP, NULL, 'manual');
```

## Verificar salud
Endpoint admin:
```
GET /api/owner/db/health
```
Devuelve:
- `missingMigrations`
- `driftFindings`
- `status` (OK/WARNING/CRITICAL)

## Qué hacer si hay drift
1) Revisa las tablas/columnas reportadas.
2) Aplica la migración faltante o crea una correctiva.
3) Reejecuta `/api/owner/db/health`.

## Consejos
- No se aplican migraciones automáticamente en runtime.
- Usa el registro `drako_migrations` como fuente de verdad.
- Si el endpoint devuelve CRITICAL, detén el rollout hasta corregir.
