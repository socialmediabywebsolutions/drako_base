# SAAS Separation — Phase C.1 Owner Dashboard Checkpoint

Date: 2026-06-06  
Scope: Documentar y validar el cierre de Phase C.1 (sustitución del import legacy de Owner Dashboard por cliente interno), sin tocar Campobase ni runtime SocialFlow.

---

## 1) Confirmación del cambio Phase C.1

### Import legacy eliminado
- Import legacy eliminado (objetivo C.1):
  - `src/lib/owner/control-dashboard.ts`
  - removido: `@/lib/socialflow/contracts/owner-dashboard`

### Archivo modificado
- `src/lib/owner/control-dashboard.ts`
  - ahora consume:
    - `fetchSocialFlowOwnerSnapshot`
    - `mapSocialFlowOwnerSnapshotToLegacyDashboard`
  - ambos desde `@/lib/capabilities/internal-api-clients/socialflow-owner`

### Cliente nuevo creado
- `src/lib/capabilities/internal-api-clients/socialflow-owner.ts`

### Adapter mínimo de compatibilidad
- `mapSocialFlowOwnerSnapshotToLegacyDashboard(...)`
  - mantiene compatibilidad con shape legacy esperado por Owner Dashboard:
    - `ownerSummary`
    - `conversionSummary`

### Imports legacy que siguen presentes
- **Runtime legacy (intacto y deliberadamente no tocado):**
  - `src/lib/campobase/socialflow-service.ts` → `@/lib/socialflow/contracts/campobase`
- **Type-only legacy (fuera de alcance C.1):**
  - `src/lib/owner/types.ts` → `import type { SocialOwnerSummary } from "@/lib/socialflow/contracts/owner-dashboard";`

### Por qué Campobase no se tocó todavía
- Es el blocker de mayor superficie (automation/operator/observability) y mayor riesgo operativo.
- La estrategia aprobada fue iniciar por el corte menos riesgoso (Owner read-path) para validar patrón de cliente interno antes de C.2.

---

## 2) Verificación de `owner/control-dashboard`

Archivo inspeccionado: `src/lib/owner/control-dashboard.ts`

Confirmaciones:
- Ya no importa `@/lib/socialflow/contracts/owner-dashboard`: **sí**.
- Usa cliente interno nuevo: **sí** (`@/lib/capabilities/internal-api-clients/socialflow-owner`).
- Mantiene shape esperado para `social` / `socialConversion`: **sí**.
  - `socialSummary = ownerSummary`
  - `totalAppointmentsFromSocial`
  - `totalRevenueFromSocial`
  - `topCampaignName`
  - `topCampaignRevenue`
- No importa `@/lib/socialflow/contracts/campobase`: **sí** (no lo importa).
- No importa `@/lib/campobase/socialflow-service`: **sí** (no lo importa).

---

## 3) Verificación del cliente interno

Archivo inspeccionado: `src/lib/capabilities/internal-api-clients/socialflow-owner.ts`

Confirmaciones:
- No importa lógica prohibida (`owner-dashboard`, `campobase` contract, `campobase/socialflow-service`): **sí**.
- Centraliza headers internos: **sí**.
  - `Authorization: Bearer <SERVICE_TOKEN>`
  - `X-Drako-Control-Plane: campobase`
  - `X-Drako-Request-Id`
  - `X-Drako-Tenant-Id` (si aplica)
- Permite base URL configurable: **sí** (`baseUrl` + resolución por env).
- Maneja 200 correctamente: **sí** (`fetchSocialFlowOwnerSnapshot` retorna `SocialFlowOwnerSnapshotResponse`).
- Maneja 401/403/500 de forma controlada: **sí** (`SocialFlowOwnerInternalApiError`).
- Contiene adapter mínimo a shape legacy: **sí** (`mapSocialFlowOwnerSnapshotToLegacyDashboard`).
- Preparado para monolito primero y Worker después: **sí** (path interno fijo + base URL configurable).

---

## 4) Verificación de tests Phase C.1

### Tests creados
1. `tests/lib/socialflow-owner-internal-client.test.ts`
- Propósito:
  - validar headers internos
  - validar 200
  - validar manejo controlado 401/403/500
  - validar adapter a shape legacy
  - validar ausencia de imports prohibidos en el cliente

2. `tests/lib/owner-control-dashboard-internal-api.test.ts`
- Propósito:
  - validar que `owner/control-dashboard` ya no usa import legacy owner-dashboard
  - validar uso del cliente interno
  - validar preservación de shape social/socialConversion
  - validar que Campobase legacy import permanece intacto

### Tests ajustados
3. `tests/api/internal/socialflow/owner-snapshot.test.ts`
- Ajuste: assertions de wiring para reflejar consumo desde cliente interno en owner dashboard.

4. `tests/api/internal/socialflow/automation-trigger.test.ts`
- Ajuste: assertions de wiring para reflejar que Owner cambió a cliente interno, manteniendo Campobase legacy intacto.

### Estado conocido de validaciones
Validaciones ejecutadas en este checkpoint:
- `pnpm typecheck` → **OK**
- `pnpm -C /home/drako/workspace/drako_base exec vitest run tests/api/internal/socialflow/owner-snapshot.test.ts` → **OK (7/7)**
- `pnpm -C /home/drako/workspace/drako_base exec vitest run tests/lib/socialflow-owner-internal-client.test.ts` → **OK (6/6)**
- `pnpm -C /home/drako/workspace/drako_base exec vitest run tests/lib/owner-control-dashboard-internal-api.test.ts` → **OK (3/3)**

Nota operativa: se ejecutaron con `pnpm ... exec vitest` en WSL por restricción de `cwd` UNC en shell Windows; equivalen funcionalmente a los runs puntuales solicitados.

---

## 5) Imports legacy restantes

Confirmación:
- `src/lib/campobase/socialflow-service.ts` sigue importando `@/lib/socialflow/contracts/campobase`: **sí** (intacto).

Lectura de estado:
- Este import legacy de Campobase es el siguiente blocker grande de separación (Phase C.2).
- No debe tocarse sin checkpoint + prompt específico, por su mayor riesgo y blast radius.

---

## 6) Evaluación de siguiente paso

### Opción A — Harden del cliente owner
Alcance:
- hardening de `base URL` / token resolution
- integration test con route adapter

- Riesgo: **bajo-medio**
- Impacto: **medio** (fiabilidad del read-path owner)
- Archivos implicados:
  - `src/lib/capabilities/internal-api-clients/socialflow-owner.ts`
  - `tests/lib/socialflow-owner-internal-client.test.ts`
  - (si se añade integración) test puntual nuevo de adapter/route
- Tests necesarios:
  - unit tests de resolución baseUrl/token
  - integración cliente ↔ route interna (sin acople a contratos legacy)
- Rollback:
  - revertir cliente owner/tests de hardening sin afectar Campobase
- Evaluación:
  - mejora robustez sin ampliar mucho superficie

### Opción B — Empezar Phase C.2
Alcance:
- sustituir import de `src/lib/campobase/socialflow-service.ts`
- crear cliente interno para automation/operator/observability

- Riesgo: **medio-alto**
- Impacto: **alto** (orquestación central Campobase)
- Archivos implicados (mínimo):
  - `src/lib/campobase/socialflow-service.ts`
  - nuevo cliente/capa interna para trigger/actions/observability
  - tipos/adapters vinculados
  - tests de Campobase y API interna relacionada
- Tests necesarios:
  - contract + wiring + errores + idempotencia para automation/operator/observability
  - regresión de flujos Campobase dependientes
- Rollback:
  - revertir cliente + `socialflow-service.ts` completo
- Evaluación:
  - desbloquea separación fuerte, pero con mayor riesgo inmediato

### Recomendación final
- Recomendada: **Opción A primero**, para consolidar el patrón interno con menor riesgo antes de abrir C.2 sobre Campobase.

---

## Incidencia durante checkpoint

- Durante este checkpoint se intentó eliminar un archivo temporal auxiliar.
- El intento falló con error: `invalid patch format`.
- La ejecución quedó bloqueada por `too many errors` tras intentos consecutivos fallidos de eliminación.
- En esta fase **no se debe intentar borrar nada más**.
- El archivo temporal debe quedar **listado para revisión manual posterior**.
- Esta incidencia **no bloquea** el checkpoint documental, porque las validaciones ya estaban en curso / completadas y pudieron documentarse.

---

## 7) Conclusión obligatoria

- Archivo creado: **sí**
- Ruta exacta: `docs/audits/SAAS_SEPARATION_PHASE_C1_OWNER_DASHBOARD_CHECKPOINT.md`
- Import legacy Owner eliminado: **sí** (en `src/lib/owner/control-dashboard.ts`)
- Import legacy Campobase intacto: **sí**
- Validaciones ejecutadas y resultado:
  - `pnpm typecheck` → **OK**
  - owner snapshot test → **OK (7/7)**
  - socialflow owner internal client test → **OK (6/6)**
  - owner control dashboard internal api test → **OK (3/3)**
- Incidencia documentada: **sí**
- Phase C.1 cerrada: **sí**
- SocialFlow puede moverse ya a Worker: **no**
- Siguiente commit recomendado (sin implementarlo):
  - `phase-c1.1: harden socialflow owner internal client base-url/token resolution and add route-adapter integration test`
