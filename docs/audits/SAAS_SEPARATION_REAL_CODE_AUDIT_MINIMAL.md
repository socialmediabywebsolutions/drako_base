# SAAS Separation Real Code Audit — Minimal

**Fecha:** 5 de Junio de 2026  
**Auditor:** Arquitecto Principal Drako  
**Tipo:** Inspección sin modificación de código  
**Estado:** AUDITORÍA INICIAL COMPLETADA

---

## 1. Workspace Detected

**Ruta raíz real:**  
`\\wsl$\Ubuntu-22.04\home\drako\workspace\drako_base`

**Carpetas principales detectadas:**

✅ **src/** — Código fuente principal (monolito actual)  
✅ **apps/** — Aplicaciones/módulos adicionales  
✅ **workers/** — Carpeta de workers (EXISTE pero necesita verificar contenido)  
✅ **docs/** — Documentación del proyecto  
✅ **docs/audits/** — Carpeta de auditorías (EXISTE con 90+ archivos)  
✅ **migrations/** — Migraciones SQL (189 archivos detectados)  
✅ **tests/** — Tests del proyecto  
✅ **scripts/** — Scripts de build/deploy  
✅ **public/** — Assets públicos  

**Estructura monolítica actual confirmada:**  
Todo el código de negocio está bajo `src/` compartiendo el mismo runtime Next.js.

---

## 2. Product Folders Detected

### En src/lib/ (Lógica de dominio):

**SocialFlow:**
- ✅ `src/lib/socialflow/` — **12 items** (ai, analytics, auth, client, contracts, linkedin, etc.)
- ✅ `src/lib/campobase/socialflow-service.ts` — Orchestrator de SocialFlow desde Campobase
- ✅ `src/lib/social-core/` — **2 files** (publishing.ts, types.ts) — SHARED CAPABILITY

**Mentoría:**
- ✅ `src/lib/mentoria/` — **52 files** (repository.ts 127KB, service.ts 145KB, types, auth, resilience, etc.)
- ✅ `src/lib/agents/mentoria/` — Agentes especializados
- ✅ `src/lib/behavioral-engine/adapters/mentoria/` — Adaptador behavioral

**Clinic:**
- ✅ `src/lib/clinic/` — **4 files** (repository.ts, types.ts, context.ts, api-helpers.ts)

**Campamento Base:**
- ✅ `src/lib/campamento-base/` — **18 items** (orchestrator, provisioning, factory, analytics, lifecycle)
- ⚠️ `src/lib/campobase/` — **NAMESPACE LEGACY** separado (socialflow-service, socialflow-platform)

**Capabilities (Shared Neutral):**
- ✅ `src/lib/capabilities/social-publishing/` — **EXTRACCIÓN YA INICIADA** (ver línea 3 en acquisition-publishing.ts)

### En src/app/ (Rutas/UI):

**SocialFlow routes:**
- `src/app/socialflow/` — App principal
- `src/app/api/socialflow/` — APIs (ai, auths, campaigns, exports, linkedin, posts, profile, setup)
- `src/app/api/operator/socialflow/` — Operator endpoints
- `src/app/campobase/socialflow/` — Campobase UI
- `src/app/products/socialflow/` — Product surface

**Mentoría routes:**
- `src/app/mentoria/` — App principal
- `src/app/mentorias/` — Alias/legacy
- `src/app/api/mentoria/` — APIs (academic, acquisition, analytics, billing, chat, exercises, family, etc.)
- `src/app/site/mentoria/` — Landing pages
- `src/app/site/mentoria-{mx,ar,es,co,cl}/` — Localized landings

**Clinic routes:**
- (No se detectaron rutas en src/app/)

### Migraciones por producto:

**SocialFlow:**
- 9 migraciones detectadas (0026_social_core.sql hasta 0190_socialflow_legacy_read_models.sql)

**Mentoría:**
- 39 migraciones detectadas (0119_mentoria_sessions.sql hasta 0186_mentoria_acquisition_tenant_isolation.sql)

**Clinic:**
- 2 migraciones detectadas (0017_clinic_tables.sql, 0018_clinic_plan.sql)

---

## 3. High-Risk Cross-Product Dependencies

### VIOLACIÓN CRÍTICA ENCONTRADA:

**Campobase → SocialFlow** (BOUNDARY VIOLATION)

**Archivo:** `src/lib/campobase/socialflow-service.ts`  
**Líneas:** 1-23  
**Import detectado:**
```typescript
import {
  getSocialFlowCampobaseOperatorObservabilityContract,
  runSocialFlowCampobaseAutomationContract,
  runSocialFlowCampobaseOperatorActionContract,
  type SocialFlowOperatorObservability,
  type SocialFlowOperatorAction,
  type SocialFlowOperatorActionResult,
} from "@/lib/socialflow/contracts/campobase";
```

**Riesgo:** HIGH  
**Motivo:** Campobase (operator layer) importa directamente tipos y funciones de SocialFlow. Esto viola el principio de separación.  
**Impacto:** No se puede separar SocialFlow sin romper Campobase.  
**Contrato recomendado:** API interna HTTP + event queue + health check endpoint.

---

### VIOLACIÓN MEDIA ENCONTRADA:

**Mentoría → Social-Core** (DEPENDENCY ON SHARED MODULE)

**Archivo:** `src/lib/mentoria/acquisition-publishing.ts`  
**Línea:** 3  
**Import detectado:**
```typescript
import { publishSocialContent } from "@/lib/capabilities/social-publishing/publisher";
```

**Riesgo:** MEDIUM  
**Motivo:** Mentoría usa un módulo compartido de publishing. ESTO ES CORRECTO (neutral capability), pero el módulo aún está en `capabilities/` y debe confirmarse que no tiene lógica de SocialFlow interna.  
**Estado:** ✅ **YA MIGRADO A CAPABILITIES** — La extracción neutral ya inició.  
**Próximo paso:** Verificar que `social-publishing` no importe de `@/lib/socialflow`.

---

### VIOLACIÓN BAJA DETECTADA:

**Owner Control → SocialFlow** (OPERATOR SURFACE DEPENDENCY)

**Archivo:** `src/lib/owner/control-dashboard.ts`  
**Línea:** 16  
**Import detectado:**
```typescript
import { getSocialOwnerDashboardSnapshot } from "@/lib/socialflow/contracts/owner-dashboard";
```

**Riesgo:** LOW  
**Motivo:** Owner dashboard importa snapshot de SocialFlow. Esto es un punto de integración legítimo, pero debe transformarse en API call.  
**Contrato recomendado:** Internal API endpoint `GET /internal/socialflow/owner-snapshot` con auth de control plane.

---

### ARCHIVOS CON TÉRMINOS SOSPECHOSOS:

**Demo/Mock:**
- `src/lib/admin/demo-data.ts` — 24 matches "socialflow"
- `.demo/` folder detectada en root

**Riesgo:** MEDIUM  
**Motivo:** Demo data puede estar mezclada con producción.  
**Acción:** Auditar si demo-data se usa en runtime de producción o solo en tests.

**Legacy:**
- `src/lib/socialflow/contracts/legacy-actions-core.ts` — 40 matches "socialflow"
- `migrations/0190_socialflow_legacy_read_models.sql`

**Riesgo:** LOW  
**Motivo:** Código legacy dentro de SocialFlow. Puede eliminarse después de separación.

---

## 4. First Safe Conclusion

### ¿Se puede separar SocialFlow ahora mismo?

**NO.** Existen bloqueadores críticos:

1. **Campobase importa directamente de SocialFlow** — Requiere contrato API antes de separar.
2. **Owner dashboard importa de SocialFlow** — Requiere endpoint interno.
3. **Shared capabilities** (`social-publishing`) debe verificarse que no tenga imports de SocialFlow.
4. **No existe worker de SocialFlow standalone** — La carpeta `workers/` existe pero su contenido no ha sido inspeccionado.
5. **Demo data mezclado** — Riesgo de llevar mocks a producción si no se limpia.

### ¿Qué falta saber antes de mover archivos?

1. **Contenido de `workers/` folder** — ¿Ya existen workers scaffolded o está vacío?
2. **Estado de `@/lib/capabilities/social-publishing`** — ¿Tiene imports de SocialFlow?
3. **Dependencias inversas completas** — Qué otros módulos importan de `@/lib/socialflow/*`?
4. **DB isolation** — ¿Usa SOCIAL_DB binding o DRACO_DB?
5. **Auth isolation** — ¿Tiene auth propio o depende de `@/lib/auths` compartido?
6. **Contract enforcement** — ¿Existen contratos TypeScript formales entre Control Plane ↔ SocialFlow?

### ¿Cuál sería el primer cambio seguro?

**COMMIT 1: Audit shared dependencies**

**Objetivo:** Detectar todos los imports de `@/lib/socialflow` fuera de SocialFlow.

**Archivos a inspeccionar (NO tocar):**
- `src/lib/**/*.ts` (buscar `from "@/lib/socialflow"`)
- `src/app/**/*.tsx` (buscar `from "@/lib/socialflow"`)
- `src/components/**/*.tsx` (buscar `from "@/lib/socialflow"`)

**Comando:**
```bash
grep -r 'from "@/lib/socialflow' src/ --include="*.ts" --include="*.tsx" > docs/audits/socialflow-imports-audit.txt
```

**Validación:**
- Sin cambios en código
- Solo creación de archivo de auditoría
- `pnpm typecheck` no debe ejecutarse (no hay cambios)

**Riesgo:** ZERO (solo lectura)

**Rollback:** Eliminar archivo de auditoría

---

**COMMIT 2: Extract @/lib/capabilities/social-publishing contract**

**Objetivo:** Documentar el contrato formal de `social-publishing` capability.

**Archivos a crear (NO tocar código):**
```
docs/contracts/social-publishing-capability-v1.md
```

**Contenido:**
- Qué exporta `social-publishing`
- Quién lo consume (Mentoría, SocialFlow, otros)
- Bindings requeridos (SOCIALFLOW_API_KEY, SOCIALFLOW_API_URL)
- Contract TypeScript formal
- Tests requeridos

**Validación:**
- Solo creación de documentación
- Sin cambios en src/

**Riesgo:** ZERO (solo documentación)

---

**COMMIT 3: Design Campamento Base ↔ SocialFlow API contract**

**Objetivo:** Diseñar el contrato HTTP interno para eliminar import directo.

**Archivos a crear:**
```
docs/contracts/campamento-base-socialflow-internal-api-v1.md
```

**Endpoints propuestos:**
```
POST /internal/socialflow/automation/trigger
GET  /internal/socialflow/observability/health
POST /internal/socialflow/operator/action
GET  /internal/socialflow/owner/snapshot
```

**Auth:**
- Service token (internal-only)
- No exposed to public

**Validación:**
- Solo diseño de contrato
- Sin cambios en código

**Riesgo:** ZERO (solo diseño)

---

### ¿Qué NO se debe tocar todavía?

❌ **NO crear carpetas en `workers/` sin plan de migración por archivo**  
❌ **NO mover archivos de `src/lib/socialflow` todavía**  
❌ **NO cambiar imports existentes**  
❌ **NO modificar `@/lib/campobase/socialflow-service.ts`**  
❌ **NO tocar Mentoría** (está en pausa según memoria)  
❌ **NO tocar Clinic** (muy pequeño, no es prioridad)  
❌ **NO tocar migraciones** (riesgo de corrupción de DB)  
❌ **NO eliminar legacy code** sin demostrar que no se usa  
❌ **NO crear mocks nuevos** como sustituto de producción  
❌ **NO hacer commits grandes** (violación de reglas de seguridad)

---

## 5. Next Audit Step

**Propuesta: SAAS_SEPARATION_REAL_CODE_AUDIT_PHASE_2.md**

**Objetivo:** Auditoría profunda de dependencias inversas de SocialFlow.

**Contenido:**

1. **Dependency Graph completo**
   - Todos los archivos que importan de `@/lib/socialflow`
   - Clasificación por tipo (API route, component, service, test)
   - Nivel de acoplamiento (tight/loose)

2. **DB Isolation Analysis**
   - Qué tablas usa SocialFlow
   - Si usa SOCIAL_DB binding o DRACO_DB
   - Si hay tenant_id isolation
   - Si hay tablas compartidas con otros productos

3. **Auth Isolation Analysis**
   - Si usa `@/lib/auths` compartido
   - Si tiene cookies propias
   - Si tiene session management propio
   - Riesgo de auth cross-contamination

4. **Workers folder inspection**
   - Contenido actual de `workers/`
   - Si ya existe `workers/socialflow/`
   - Si tiene wrangler.toml
   - Si tiene código o está vacío

5. **Shared runtime dependencies**
   - `@/lib/db` usage
   - `@/lib/auths` usage
   - `@/lib/http` usage
   - `@/lib/cf` env bindings usage

6. **Contract formalization**
   - TypeScript interfaces para cada contrato
   - Request/Response types
   - Error types
   - Mock types para tests

7. **Migration strategy per file**
   - Cada archivo de `src/lib/socialflow` con destino propuesto
   - Keep in monolith / Move to worker / Delete
   - Dependencias de cada archivo
   - Orden de migración seguro

**Formato:**
- Solo auditoría, sin código
- Basado en inspección real
- Con evidencia (líneas de código reales)
- Con riesgos medibles
- Con plan ejecutable commit-by-commit

**Deliverable:**
- Documento markdown de 200-400 líneas
- Diagramas ASCII de dependencias
- Tabla de 100+ archivos clasificados
- Secuencia de 10-15 commits seguros

---

## RESUMEN EJECUTIVO

### ✅ Confirmaciones:

1. **Monolito Next.js confirmado** — Todo bajo `src/` compartiendo runtime
2. **SocialFlow existe como módulo** — 12+ items en `src/lib/socialflow/`
3. **Mentoría existe como módulo** — 52+ files en `src/lib/mentoria/`
4. **Campamento Base existe** — Pero mezclado con Campobase (namespace dual)
5. **Migrations por producto** — 189 migraciones totales, 9 SocialFlow, 39 Mentoría
6. **Capabilities extraction iniciada** — `social-publishing` ya existe
7. **Workers folder existe** — Pero no inspeccionado todavía

### ⚠️ Bloqueadores detectados:

1. **Campobase → SocialFlow import directo** (HIGH RISK)
2. **Owner → SocialFlow import directo** (LOW RISK)
3. **Demo data mezclado** (MEDIUM RISK)
4. **No contract enforcement** — Imports directos en vez de APIs
5. **No worker scaffold verificado** — No sabemos si `workers/` tiene contenido

### 📋 Próximos pasos inmediatos:

1. ✅ **Archivo creado:** `SAAS_SEPARATION_REAL_CODE_AUDIT_MINIMAL.md`
2. ⏭️ **Ejecutar:** Grep audit de imports (Commit 1 propuesto)
3. ⏭️ **Documentar:** Contract de `social-publishing` (Commit 2 propuesto)
4. ⏭️ **Diseñar:** Contract Campamento ↔ SocialFlow (Commit 3 propuesto)
5. ⏭️ **Auditoría Phase 2:** Dependency graph completo
6. ⏭️ **Inspeccionar:** Contenido de `workers/` folder
7. ⏭️ **Clasificar:** 100+ archivos de SocialFlow con destino propuesto

### 🚨 Reglas de seguridad respetadas:

✅ No se modificó código de producción  
✅ No se crearon carpetas nuevas  
✅ No se movieron archivos  
✅ No se ejecutó refactor  
✅ No se tocó Mentoría (en pausa)  
✅ No se tocaron migraciones  
✅ Solo inspección y documentación  

---

**Fin del informe minimal.**
