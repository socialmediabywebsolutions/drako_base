# Clinic Platform Ownership Audit

**Fecha:** 2026-06-07  
**Bloque:** `audit clinic platform ownership before canonicalization`  
**Tipo:** inspección y clasificación (sin cambios de código productivo)

---

## 1) Inspección de módulos Clinic legacy

### 1.1 `src/lib/campobase/clinic-platform.ts`

**Exports públicos**
- `CLINIC_PLATFORM_SAAS_ID`
- `clinicPlatformDefinition`
- `clinicPlatformBootstrap`

**Imports actuales**
- `@/lib/integration-core/providers/whatsapp`
- `@/lib/saas-contract` (types + helpers)
- `@/lib/campobase/clinic-platform-service`

**¿Importa desde `@/lib/campobase/*`?**
- Sí (`@/lib/campobase/clinic-platform-service`).

**Dependencias core**
- `saas-contract`: sí
- `automation-core`: no directo
- `integration-core`: sí (whatsapp key)
- `observability-core`: no

**Lógica contenida**
- Mayormente contrato/registro de plataforma (definition + bootstrap wrapper).
- La lógica funcional real se delega al service legacy.

**Aporte a `platform-bootstrap`**
- Entrega definición + bootstrap de `clinic` para `registerSaasPlatformDefinition/registerSaasPlatformBootstrap`.

**Consumidores detectados**
- Runtime:
  - `src/lib/campobase/platform-bootstrap.ts` (import dinámico)
- Tests:
  - `tests/lib/saas-contract-definitions.test.ts`
  - `tests/lib/campobase-platform-bootstrap.test.ts` (mock)

**Riesgo general**
- **Medium** (el wrapper es simple, pero apunta a service legacy con lógica de dominio).

---

### 1.2 `src/lib/campobase/clinic-platform-service.ts`

**Exports públicos**
- `CLINIC_DAILY_APPOINTMENT_HEALTH_KEY`
- `registerClinicPlatform`

**Imports actuales**
- `@/lib/automation-core`
- `@/lib/integration-core`
- `@/lib/integration-core/providers/whatsapp`
- `@/lib/clinic/context`
- `@/lib/appointments/repository`
- `@/lib/whatsapp/repository`

**¿Importa desde `@/lib/campobase/*`?**
- No (es el propio módulo legacy; consume módulos de dominio no-campobase).

**Dependencias core**
- `saas-contract`: no
- `automation-core`: sí
- `integration-core`: sí
- `observability-core`: no

**Lógica contenida**
- **Sí contiene lógica de producto Clinic**:
  - cálculo de salud de citas (upcoming/unconfirmed/overdue followups)
  - resolución de contexto Clinic
  - wiring real con appointments/whatsapp repos
  - bootstrap de automatización + conexión de integración para un SaaS Clinic

**¿Solo registro/bootstrap de plataforma?**
- No. Incluye comportamiento operativo de dominio (appointment health) más provisioning de integración.

**Aporte a `platform-bootstrap`**
- Es el motor real detrás de `clinicPlatformBootstrap.connect`.

**Consumidores detectados**
- Runtime:
  - `src/lib/campobase/clinic-platform.ts`
- Tests:
  - `tests/lib/campobase-clinic-platform-service.test.ts`

**Riesgo general**
- **High** (mezcla bootstrap + lógica funcional específica de vertical Clinic).

---

### 1.3 Señales de producto/vertical Clinic (sin abrir archivos masivos)

**Rutas Clinic dedicadas**
- `src/app/api/clinic/*` (appointments, leads, finance, profile, services, metrics)
- `src/app/clinic/*` (dashboard, agenda, leads, finance, messages)
- `src/app/api/site/clinic/leads/route.ts` y `src/app/site/clinic/*`

**Componentes Clinic**
- `src/components/clinic/no-subscription-state.tsx` (copy explícita de pack/vertical clinic)

**Librerías verticales Clinic**
- `src/lib/clinic/context.ts`
- `src/lib/clinic/repository.ts`
- `src/lib/clinic/types.ts` (modelo de dominio extenso: perfil, servicios, citas, finanzas, inventario, pricing)
- `src/lib/site/clinic.ts` (sitio público Clinic)

**Evidencia contractual/arquitectónica**
- `docs/contracts/campamento-base-api-v1.0.md`: Campamento Base expone contrato a SaaS independientes (incluye Clinic).
- `docs/knowledge-pack/01_mapa_global_del_sistema.md`: Campamento Base = control plane; verticales separadas.

**Evidencia comercial/SaaS**
- plan code: `drako_clinic_starter` (`src/lib/clinic/types.ts`, migrations, docs de Stripe/env)
- menciones explícitas de vertical Clinic en docs de catálogo/owner/boundaries.

---

## 2) Determinación de ownership

### Opción A — Clinic como capacidad interna de Campamento Base
**A favor**
- `clinic-platform.ts` hoy vive junto al bootstrap legacy de control-plane.
- Usa automation/integration framework común.

**En contra**
- Existe dominio vertical Clinic amplio en `src/lib/clinic/*`, `src/app/clinic/*`, `src/app/api/clinic/*`.
- Contrato API y docs describen Clinic como SaaS/vertical conectado al control plane.

**Impacto arquitectónico**
- Empujaría lógica de producto al namespace de control plane.

**Riesgo**
- **High** (contaminación de boundaries).

**Recomendación**
- No preferida.

---

### Opción B — Clinic como SaaS vertical independiente; Campamento Base solo orquesta
**A favor**
- Evidencia fuerte de vertical dedicado (rutas, UI, modelo, plan, repo, sitio público).
- Coherente con contrato Campamento Base ↔ SaaS independientes.

**En contra**
- Parte de onboarding/registro aún está en capa legacy `campobase`.

**Impacto arquitectónico**
- Mantiene separación de capas y reduce riesgo de mezcla control-plane/producto.

**Riesgo**
- **Medium** (requiere bloques de migración por contrato).

**Recomendación**
- **Opción recomendada**.

---

### Opción C — Clinic legacy/demo congelado hasta decisión de producto
**A favor**
- Menor riesgo inmediato de romper comportamiento.

**En contra**
- Evidencia actual muestra producto activo (no solo demo) con APIs/UI y plan comercial.

**Impacto arquitectónico**
- Mantiene deuda y bloquea progreso de separación.

**Riesgo**
- **Medium** (deuda sostenida, bloqueo de canonicalización).

**Recomendación**
- Solo temporal, no estrategia principal.

---

### Opción D — Evidencia insuficiente
**A favor**
- Conservador.

**En contra**
- Hay evidencia suficiente y consistente de vertical independiente.

**Impacto arquitectónico**
- Retrasa decisiones necesarias.

**Riesgo**
- **Low** técnico / **Medium** organizacional.

**Recomendación**
- No necesaria en este estado.

---

## 3) Namespace correcto para Clinic

### Opción 1 — `src/lib/campamento-base/clinic-platform.ts`
- **Riesgo:** high
- **Impacto:** puede mezclar control-plane con lógica de producto
- **Archivos implicados:** módulo canónico clinic-platform + adapters + bootstrap
- **Tests necesarios:** contratos SaaS + bootstrap + clinic service + guardrail
- **Rollback:** posible, pero con riesgo de contaminación
- **Evaluación:** no recomendado como destino final de lógica Clinic

### Opción 2 — `src/lib/clinic/clinic-platform.ts`
- **Riesgo:** medium
- **Impacto:** alinea ownership vertical
- **Archivos implicados:** nuevo wrapper en namespace Clinic + adapters
- **Tests necesarios:** clinic-platform/service + integración bootstrap por contrato
- **Rollback:** moderado
- **Evaluación:** opción sólida

### Opción 3 — `src/lib/clinic-platform/` (namespace vertical equivalente)
- **Riesgo:** medium
- **Impacto:** separación clara pero introduce nuevo namespace transversal
- **Archivos implicados:** carpeta nueva + migraciones de imports
- **Tests necesarios:** similares a opción 2
- **Rollback:** moderado/alto (más movimiento)
- **Evaluación:** viable, pero más costosa que opción 2

### Opción 4 — mantener en `src/lib/campobase/` legacy congelado
- **Riesgo:** low inmediato / medium deuda
- **Impacto:** bloquea canonicalización de bootstrap
- **Archivos implicados:** ninguno
- **Tests necesarios:** freeze/guardrails actuales
- **Rollback:** no aplica
- **Evaluación:** solo medida temporal

### Opción 5 — contrato neutral en `src/lib/campamento-base/` para orquestar Clinic sin mover lógica Clinic
- **Riesgo:** low/medium
- **Impacto:** alto valor para separar ownership sin contaminar Campamento Base
- **Archivos implicados:** contrato/orquestador neutral en campamento-base + adapters de enlace
- **Tests necesarios:** contrato neutral + compat bootstrap + freeze
- **Rollback:** fácil (capa delgada)
- **Evaluación:** **recomendación final** en combinación con Opción 2 como destino de vertical.

**Recomendación final de namespace**
- No mover lógica de producto Clinic a `src/lib/campamento-base/`.
- Mantener Campamento Base como orquestador por contrato neutral (Opción 5).
- Evolucionar wrapper/plataforma de Clinic hacia namespace vertical (`src/lib/clinic/...`) (Opción 2).

---

## 4) Impacto sobre `platform-bootstrap`

`src/lib/campobase/platform-bootstrap.ts` hoy:
- importa dinámicamente `@/lib/campobase/clinic-platform`
- registra definition/bootstrap de clinic junto a socialflow/taskops

**Cómo usa Clinic actualmente**
- consume `clinicPlatformDefinition` + `clinicPlatformBootstrap`
- delega `connect` en service Clinic legacy

**¿Clinic bloquea crear `src/lib/campamento-base/platform-bootstrap.ts`?**
- **Sí.** Mientras Clinic siga colgado de módulos legacy sin contrato neutral/canónico limpio.

**¿Se puede aislar por contrato?**
- **Sí.** Definiendo contrato neutral de orquestación en Campamento Base y manteniendo implementación de dominio en namespace Clinic.

**¿Conviene esperar antes de tocar Clinic?**
- Conviene evitar mover lógica de producto directamente a campamento-base; pero sí conviene preparar contrato neutral como siguiente paso seguro.

**Cambio mínimo seguro (si se hiciera en otro bloque)**
- Mantener Clinic legacy congelado y avanzar primero con contrato neutral de enlace (sin mover runtime Clinic).

---

## 5) Comparación con SocialFlow

**Por qué SocialFlow sí pudo canonizarse**
- Existía ya servicio canónico en `src/lib/campamento-base/socialflow-control-plane-service`.
- `socialflow-platform` era más thin-wrapper de definición/bootstrap.
- La migración dejó adapter legacy claro sin contaminar canónico.

**¿Clinic sigue el mismo patrón?**
- **No completamente.** Clinic depende de `clinic-platform-service` con lógica de dominio (appointments/followups/context/subscription/integration).

**¿Clinic tiene más lógica de producto?**
- **Sí.** Evidencia fuerte en `src/lib/clinic/*`, `src/app/clinic/*`, `src/app/api/clinic/*`, plan comercial propio.

**¿Sería peligroso meter Clinic dentro de Campamento Base?**
- **Sí, riesgo alto** de romper separación control-plane vs vertical SaaS.

---

## 6) Próximo bloque recomendado (sin implementar)

### Bloque recomendado
**`define neutral campamento-base ↔ clinic platform contract before any clinic canonicalization`**

**Objetivo**
- Separar ownership: Campamento Base orquesta; Clinic implementa su lógica en vertical.

**Archivos a tocar (siguiente bloque)**
- contrato neutral nuevo en `src/lib/campamento-base/` (solo interfaz/orquestación)
- wiring mínimo en módulo legacy de bootstrap para consumir el contrato (sin mover lógica clinic runtime)
- tests de contrato/compatibilidad

**Archivos que NO deben tocarse**
- `src/lib/clinic/*` runtime de dominio
- `src/app/api/clinic/*`
- `src/app/clinic/*`
- `src/components/clinic/*`
- `migrations/*`

**Tests necesarios**
- guardrail namespace freeze
- test de contrato neutral (no imports campobase nuevos)
- compat test de bootstrap

**Validaciones**
- `pnpm typecheck`
- vitest puntual de contrato + bootstrap + freeze

**Rollback**
- revert del contrato neutral y wiring mínimo, sin impacto en runtime Clinic.

**Por qué es el paso más seguro**
- Evita contaminar Campamento Base con lógica de producto Clinic.
- Reduce bloqueo arquitectónico sin tocar runtime vertical.
- Mantiene rollback simple.

---

## 7) Conclusión

- Clinic muestra señales consistentes de **SaaS vertical independiente**.
- Campamento Base debería orquestar Clinic por contrato neutral, no absorber su lógica de producto.
- `platform-bootstrap` sigue bloqueado por dependencia legacy Clinic hasta resolver ese contrato de ownership.
