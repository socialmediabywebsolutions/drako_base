# Mentoría P0-1 Reclassification: Acquisition Runtime Drift
**Fecha:** 2026-05-22  
**Tipo:** Runtime Drift Analysis (READ-ONLY)  
**Alcance:** Feature `acquisition` en Mentoría

---

## RESUMEN EJECUTIVO

**Conclusión:** P0-1 es **RUNTIME DRIFT** — Feature acquisition está **FUTURA/NO DESPLEGADA**

### Estado Actual
- ✅ Migración canónica `0162_mentoria_acquisition.sql` existe en repo
- ❌ Tabla `acquisition_posts` **NO existe** en `saas_mentorias_prod_db`
- ❌ Tabla `acquisition_posts` **NO existe** en `drako_db_prod`
- ✅ Código TypeScript completo y funcional en `src/lib/mentoria/acquisition-*`
- ✅ API endpoint `/api/mentoria/acquisition` implementado
- ❌ **NO hay frontend** que consuma el endpoint
- ❌ **NO hay jobs/crons** que ejecuten acquisition

### Clasificación
**Tipo de Drift:** FUTURE_FEATURE_NOT_DEPLOYED

**Riesgo Real:** ❌ **FALSO POSITIVO como P0 blocker**
- Feature NO está en uso en runtime
- NO afecta usuarios en producción
- Migración NO fue aplicada intencionalmente (feature futura)

**Riesgo de Código:** ⚠️ **MEDIO — Code-Schema Mismatch**
- Si alguien accede a `/api/mentoria/acquisition` → CRASH inmediato
- Código asume tabla que no existe

---

## DIAGNÓSTICO COMPLETO

### 1. Verificación de Migración en Repo

**Archivo:** `@migrations/0162_mentoria_acquisition.sql:1-25`
```sql
-- Mentoria User Acquisition Tracking
-- Tracks published posts and their performance metrics

CREATE TABLE IF NOT EXISTS acquisition_posts (
  id TEXT PRIMARY KEY,
  post_id TEXT NOT NULL,
  channel TEXT NOT NULL,
  content TEXT NOT NULL,
  published_at TEXT NOT NULL,
  external_id TEXT,
  clicks INTEGER NOT NULL DEFAULT 0,
  signups INTEGER NOT NULL DEFAULT 0,
  trial_starts INTEGER NOT NULL DEFAULT 0,
  created_at TEXT NOT NULL,
  updated_at TEXT NOT NULL
);
-- (sin tenant_id en versión original)
```

**Estado:** ✅ Existe en repo (commit history verificable)

### 2. Verificación Manual en Producción (USER)

**D1 verificadas:**
- `saas_mentorias_prod_db` → ❌ NO tiene `acquisition_posts`
- `drako_db_prod` → ❌ NO tiene `acquisition_posts`

**Query ejecutada:**
```sql
SELECT name FROM sqlite_master WHERE type = 'table' AND name LIKE '%acquisition%';
-- Resultado: 0 rows
```

**Conclusión:** Migración 0162 **nunca fue aplicada** en producción.

### 3. Binding de Base de Datos

**Código de acquisition usa:**
- `@src/lib/mentoria/acquisition-publishing.ts:1` → `import { getDb } from "@/lib/mentoria/db"`
- `@src/lib/mentoria/db.ts:21-28` → `getDb()` llama `getMentoriaDb()`
- `@src/lib/mentoria/get-mentoria-db.ts:6-7` → Retorna `runtimeEnv.MENTORIA_DB`

**Binding en producción:**
- `@wrangler.workers.toml:46-48` → `MENTORIA_DB` → `saas_mentorias_prod_db`
- `@workers/mentorias/wrangler.workers.toml:28-33` → `MENTORIA_DB` → `saas_mentorias_prod_db` con `migrations_dir = "../../migrations"`

**D1 objetivo correcta:** `saas_mentorias_prod_db` (67b013a3-dcd8-424b-adf9-558895817841)

### 4. Usos Reales del Código

**API Endpoint:**
- `@src/app/api/mentoria/acquisition/route.ts:1-106` — Endpoint completo implementado

**Métodos disponibles:**
- `GET /api/mentoria/acquisition` → métricas + scheduled posts (requiere role admin)
- `POST /api/mentoria/acquisition` → acciones (generate_daily, publish_pending, track_*)

**Control de Acceso:**
```typescript
// Línea 13-15
if (actor.role !== "admin") {
  return NextResponse.json({ ok: false, error: "UNAUTHORIZED" }, { status: 403 });
}
```

**Hallazgo:** ✅ Solo admins pueden acceder

**Librerías:**
- `@src/lib/mentoria/acquisition-content.ts` — Genera contenido de posts
- `@src/lib/mentoria/acquisition-publishing.ts` — Publica y trackea posts
- `@src/lib/mentoria/acquisition-scheduler.ts` — Programa posts

**Estado:** ✅ Código completo y cohesivo

### 5. Integraciones Frontend

**Búsqueda en componentes:**
```bash
grep -r "acquisition" src/components/
# Resultado: 0 matches
```

```bash
grep -r "/api/mentoria/acquisition" src/
# Resultado: 0 matches (excepto el propio route.ts)
```

**Hallazgo:** ❌ NO hay UI que consuma esta API

**Componentes revisados:**
- `workspace.tsx` → NO menciona acquisition
- `workspace-nav.tsx` → NO tiene sección acquisition
- `workspace-board.tsx` → NO tiene quick actions de acquisition
- `parent-hub.tsx` → NO menciona acquisition

**Conclusión:** Feature NO está cableada en frontend

### 6. Jobs/Cron que Ejecuten Acquisition

**Búsqueda en workers:**
```bash
grep -r "acquisition" workers/
# Resultado: 0 matches
```

**Búsqueda en scheduler:**
```bash
grep -r "acquisition" workers/drako-scheduler/
# Resultado: 0 matches
```

**Hallazgo:** ❌ NO hay jobs automáticos que usen acquisition

### 7. Comparación con Scheduled Posts (Patrón Similar)

**Migración 0163:**
- `@migrations/0163_mentoria_scheduled_posts.sql` — Crea `scheduled_posts` SIN `tenant_id`

**Migración 0165 (FIX):**
- `@migrations/0165_mentoria_scheduled_posts_tenant.sql` — Añade `tenant_id` vía recreate table

**Patrón:**
```sql
-- 0165: Fix tenant isolation
BEGIN TRANSACTION;

CREATE TABLE IF NOT EXISTS scheduled_posts_new (
  id TEXT PRIMARY KEY,
  tenant_id TEXT NOT NULL,  -- ← AÑADIDO
  -- ... resto de columnas
  CHECK (tenant_id IS NOT NULL AND tenant_id <> '')
);

-- Migrate legacy data con tenant_id = '__UNSCOPED__'
INSERT OR IGNORE INTO scheduled_posts_new (...)
SELECT id, '__UNSCOPED__' AS tenant_id, ...
FROM scheduled_posts
WHERE id NOT IN (SELECT id FROM scheduled_posts_new);

-- Replace table
DROP TABLE IF EXISTS scheduled_posts_backup;
ALTER TABLE scheduled_posts RENAME TO scheduled_posts_backup;
ALTER TABLE scheduled_posts_new RENAME TO scheduled_posts;

COMMIT;
```

**Hallazgo:** ✅ Existe patrón canónico para fix de tenant_id

**Búsqueda de fix para acquisition_posts:**
```bash
grep -r "acquisition_posts" migrations/*.sql
# Resultado: Solo 0162 (creación) y 0173 (FK reference)
```

**Conclusión:** ❌ NO existe migración 0166_mentoria_acquisition_tenant.sql (o similar)

### 8. Revisión de Migración 0173 (Resilience Runtime)

**Archivo:** `@migrations/0173_mentoria_resilience_runtime.sql:55-59`
```sql
CREATE TABLE IF NOT EXISTS mentoria_publish_jobs (
  id TEXT PRIMARY KEY,
  tenant_id TEXT NOT NULL,
  post_id TEXT,
  published_at TEXT,
  confirmed_at TEXT,
  FOREIGN KEY (tenant_id) REFERENCES tenants(id),
  FOREIGN KEY (post_id) REFERENCES acquisition_posts(id)  -- ← FK a tabla que NO existe
);
```

**Hallazgo:** ⚠️ **BROKEN FK CONSTRAINT**
- Migración 0173 referencia `acquisition_posts(id)`
- Pero `acquisition_posts` NO existe en producción
- FK constraint puede estar:
  - Ignorada (SQLite permite FK a tablas inexistentes si PRAGMA foreign_keys = OFF)
  - Bloqueando creación de `mentoria_publish_jobs`

**Verificación requerida:**
```sql
-- Query en saas_mentorias_prod_db:
SELECT name FROM sqlite_master WHERE type = 'table' AND name = 'mentoria_publish_jobs';
```

**Hipótesis:** Si `mentoria_publish_jobs` NO existe → 0173 falló por FK broken

### 9. Endpoints Activos en Runtime

**Rutas Mentoría activas:**
```
/api/mentoria/onboarding
/api/mentoria/session
/api/mentoria/chat
/api/mentoria/workspace
/api/mentoria/exercises
/api/mentoria/focus
/api/mentoria/planner
/api/mentoria/billing/*
/api/mentoria/family/*
/api/mentoria/growth/*
/api/mentoria/academic/*
/api/mentoria/analytics
/api/mentoria/acquisition  ← EXISTE pero NO se usa
```

**Tráfico esperado a `/api/mentoria/acquisition`:**
- Frontend NO hace requests
- Jobs NO ejecutan
- Solo accesible manualmente vía curl/Postman

**Riesgo de crash:**
```bash
curl -X GET https://mentorias.drako.systems/api/mentoria/acquisition \
  -H "Cookie: session=..."
# Resultado esperado: D1_ERROR no such table: acquisition_posts
```

---

## ANÁLISIS DE RIESGO

### Riesgo de Producción (Usuarios)

**Nivel:** ❌ **NINGUNO**

**Razones:**
1. ✅ Feature NO está expuesta en UI
2. ✅ Endpoint requiere role `admin` (solo internal team)
3. ✅ NO hay jobs automáticos ejecutando
4. ✅ NO hay integración con flujos de usuario

**Conclusión:** Usuarios NO pueden triggear crash.

### Riesgo de Desarrollo (Internal Team)

**Nivel:** ⚠️ **BAJO-MEDIO**

**Escenario 1:** Admin accede manualmente a `/api/mentoria/acquisition`
- Request: `GET /api/mentoria/acquisition`
- Código ejecuta: `publisher.getPerformanceMetrics()`
- Query: `SELECT ... FROM acquisition_posts`
- **Resultado:** D1_ERROR `no such table: acquisition_posts`
- **Impacto:** 500 error, admin ve error en respuesta (no crash silencioso)

**Escenario 2:** Future feature activation sin migración
- PM habilita UI de acquisition sin coordinar con Engineering
- Users start clicking → mass 500 errors
- **Impacto:** Feature rota, but fail-fast (no data corruption)

### Riesgo de Migración (0173 Resilience Runtime)

**Nivel:** ⚠️ **MEDIO**

**Problema:**
- `mentoria_publish_jobs` tiene FK a `acquisition_posts(id)`
- Si FK constraint está ENABLED → tabla NO puede crearse
- Resilience layer puede estar parcialmente roto

**Verificación necesaria:**
```sql
-- En saas_mentorias_prod_db:
SELECT name FROM sqlite_master WHERE type = 'table' AND name = 'mentoria_publish_jobs';

PRAGMA foreign_keys;
-- Si ON → FK violations bloquearon creación
-- Si OFF → tabla existe pero FK no se valida
```

**Impacto si tabla NO existe:**
- `@src/lib/mentoria/resilience/socialflow-validation.ts` → CRASH al intentar `INSERT INTO mentoria_publish_jobs`

---

## DETERMINACIÓN DE FIX CORRECTO

### Opciones Evaluadas

#### A) Aplicar migración 0162 + fix tenant_id en saas_mentorias_prod_db
**Pros:**
- Prepara infraestructura para feature futura
- Alinea código con schema
- Fix FK constraint de 0173

**Contras:**
- Tabla vacía en producción (waste)
- Puede confundir a team (¿está activa la feature?)

**Recomendación:** ✅ **SÍ** — Pero como preparación, no como P0

#### B) Aplicar migración en drako_db_prod
**Análisis:** ❌ **NO**
- Código usa binding `MENTORIA_DB` → `saas_mentorias_prod_db`
- Poner tabla en `drako_db_prod` → mismatch de binding
- Requeriría cambiar código para usar `DRACO_DB`

**Recomendación:** ❌ **NO** — Binding incorrecto

#### C) Mover/Corregir bindings
**Análisis:** ❌ **NO**
- `MENTORIA_DB` es el binding correcto para Mentoría product
- Cambiar a `DRACO_DB` rompe isolación SaaS-specific
- Architecture decision: Mentoría usa su propia D1

**Recomendación:** ❌ **NO** — Rompe arquitectura

#### D) Desactivar/Aislar feature acquisition hasta completar schema
**Análisis:** ✅ **YA ESTÁ DESACTIVADA**
- Frontend NO la usa
- Jobs NO la ejecutan
- Solo admin puede acceder vía API

**Acciones posibles:**
1. Añadir feature flag `ACQUISITION_ENABLED=false` en route
2. Retornar 501 Not Implemented si flag disabled
3. Documentar como "future feature"

**Recomendación:** ✅ **SÍ** — Como safety net temporal

#### E) Deprecar acquisition si no es parte del flujo actual
**Análisis:** ❌ **NO**
- Código es cohesivo y bien diseñado
- Feature tiene valor (user acquisition tracking)
- Solo está "no deployada" aún

**Recomendación:** ❌ **NO** — Feature es válida, solo pendiente de activación

---

## PLAN DE ACCIÓN RECOMENDADO

### FASE 1: Fix FK Constraint (CRÍTICO — 0173 puede estar roto)

**Prioridad:** 🔴 **BLOCKER si mentoria_publish_jobs NO existe**

**Paso 1: Verificar estado de tabla**
```sql
-- Ejecutar en saas_mentorias_prod_db:
SELECT name FROM sqlite_master WHERE type = 'table' AND name = 'mentoria_publish_jobs';
```

**Escenario A:** Tabla existe
- FK constraint fue ignorado (PRAGMA foreign_keys = OFF)
- Resilience layer funciona pero FK no se valida
- **Acción:** Aplicar migración 0162 + tenant fix para validar FK

**Escenario B:** Tabla NO existe
- 0173 falló por FK a tabla inexistente
- Resilience layer ROTO parcialmente
- **Acción:** Aplicar 0162 primero, luego re-aplicar 0173

**Tiempo estimado:** 30 minutos

### FASE 2: Crear Migración de Tenant Isolation

**Prioridad:** 🟡 **IMPORTANTE — Preparar schema correcto**

**Migración:** `0186_mentoria_acquisition_tenant_isolation.sql`

```sql
-- Mentoria Acquisition Posts - Tenant Isolation Fix
-- Follows pattern from 0165_mentoria_scheduled_posts_tenant.sql

BEGIN TRANSACTION;

-- Create table with tenant_id (fail-closed design)
CREATE TABLE IF NOT EXISTS acquisition_posts_new (
  id TEXT PRIMARY KEY,
  tenant_id TEXT NOT NULL,
  post_id TEXT NOT NULL,
  channel TEXT NOT NULL,
  content TEXT NOT NULL,
  published_at TEXT NOT NULL,
  external_id TEXT,
  clicks INTEGER NOT NULL DEFAULT 0,
  signups INTEGER NOT NULL DEFAULT 0,
  trial_starts INTEGER NOT NULL DEFAULT 0,
  created_at TEXT NOT NULL,
  updated_at TEXT NOT NULL,
  FOREIGN KEY (tenant_id) REFERENCES tenants(id),
  CHECK (tenant_id IS NOT NULL AND tenant_id <> '')
);

-- Migrate legacy data (if any)
-- Since table doesn't exist in prod, this is no-op but safe
INSERT OR IGNORE INTO acquisition_posts_new (
  id, tenant_id, post_id, channel, content, published_at, external_id, 
  clicks, signups, trial_starts, created_at, updated_at
)
SELECT 
  id,
  '__LEGACY_UNSCOPED__' AS tenant_id,
  post_id,
  channel,
  content,
  published_at,
  external_id,
  clicks,
  signups,
  trial_starts,
  created_at,
  updated_at
FROM acquisition_posts
WHERE id NOT IN (SELECT id FROM acquisition_posts_new);

-- Replace table
DROP TABLE IF EXISTS acquisition_posts_backup;
ALTER TABLE acquisition_posts RENAME TO acquisition_posts_backup;
ALTER TABLE acquisition_posts_new RENAME TO acquisition_posts;

-- Indexes for tenant-scoped queries
CREATE INDEX IF NOT EXISTS idx_acquisition_posts_tenant_channel
  ON acquisition_posts(tenant_id, channel, published_at DESC);

CREATE INDEX IF NOT EXISTS idx_acquisition_posts_tenant_metrics
  ON acquisition_posts(tenant_id, clicks, signups, trial_starts);

COMMIT;
```

**Aplicación:**
```bash
# Aplicar contra saas_mentorias_prod_db
wrangler d1 execute saas_mentorias_prod_db \
  --file=migrations/0186_mentoria_acquisition_tenant_isolation.sql \
  --remote
```

**Tiempo estimado:** 15 minutos

### FASE 3: Fix Código (Añadir tenant filters)

**Prioridad:** 🟡 **IMPORTANTE — Cerrar loop code-schema**

**Archivos a modificar:**

**1. acquisition-publishing.ts — Añadir tenant a GET methods**

```typescript
// ANTES (línea 119-138):
async getPublishedPost(id: string): Promise<PublishedPost | null> {
  const row = await this.db
    .prepare(`SELECT * FROM acquisition_posts WHERE id = ? LIMIT 1`)
    .bind(id)
    .first<PublishedPostRow>();
  // ...
}

// DESPUÉS:
async getPublishedPost(tenantId: string, id: string): Promise<PublishedPost | null> {
  const row = await this.db
    .prepare(`SELECT * FROM acquisition_posts WHERE tenant_id = ? AND id = ? LIMIT 1`)
    .bind(tenantId, id)
    .first<PublishedPostRow>();
  // ...
}

// Similar para getPublishedPostsByChannel y getPerformanceMetrics
```

**2. Actualizar tipos**

```typescript
export type PublishedPost = {
  id: string;
  tenantId: string;  // ← AÑADIR
  postId: string;
  channel: "linkedin" | "instagram" | "tiktok";
  content: string;
  publishedAt: string;
  externalId?: string;
  clicks: number;
  signups: number;
  trialStarts: number;
};

type PublishedPostRow = {
  id: string;
  tenant_id: string;  // ← AÑADIR
  post_id: string;
  channel: string;
  content: string;
  published_at: string;
  external_id: string | null;
  clicks: number;
  signups: number;
  trial_starts: number;
  created_at: string;
  updated_at: string;
};
```

**3. API route — Pasar tenantId**

```typescript
// acquisition/route.ts línea 20
const metrics = await publisher.getPerformanceMetrics(actor.tenantId);
```

**Tiempo estimado:** 20 minutos

### FASE 4: Feature Flag (Safety Net Temporal)

**Prioridad:** 🟢 **NICE TO HAVE — Prevención**

**Código:**

```typescript
// src/app/api/mentoria/acquisition/route.ts
export async function GET(request: Request) {
  try {
    const actor = await requireCurrentMentoriaSession(request);
    
    if (actor.role !== "admin") {
      return NextResponse.json({ ok: false, error: "UNAUTHORIZED" }, { status: 403 });
    }

    // FEATURE FLAG: Acquisition not yet deployed
    const ACQUISITION_ENABLED = process.env.ACQUISITION_ENABLED === "true";
    if (!ACQUISITION_ENABLED) {
      return NextResponse.json({ 
        ok: false, 
        error: "FEATURE_NOT_AVAILABLE",
        message: "Acquisition tracking feature is not yet deployed. Coming soon."
      }, { status: 501 });
    }

    // ... resto del código
  }
}
```

**Activación cuando feature esté lista:**
```bash
# En wrangler.workers.toml
[env.production.vars]
ACQUISITION_ENABLED = "true"
```

**Tiempo estimado:** 10 minutos

### FASE 5: Tests Obligatorios

**Prioridad:** 🟡 **IMPORTANTE**

**Tests necesarios:**

```typescript
// tests/lib/mentoria-acquisition-tenant-isolation.test.ts
describe("AcquisitionPublisher tenant isolation", () => {
  beforeEach(async () => {
    // Setup DB con 0186 aplicada
  });

  it("getPublishedPost filters by tenant", async () => {
    // Arrange: create post for tenant_a
    const publisher = new AcquisitionPublisher();
    await publisher.publishPost(mockPost, "tenant_a");
    
    // Act: try to get from tenant_b
    const result = await publisher.getPublishedPost("tenant_b", postId);
    
    // Assert: returns null
    expect(result).toBeNull();
  });

  it("getPerformanceMetrics scoped to tenant", async () => {
    // Arrange: create metrics for tenant_a and tenant_b
    // Act: call with tenant_a
    // Assert: only tenant_a metrics aggregated
  });
});

// tests/api/mentoria-acquisition-feature-flag.test.ts
describe("POST /api/mentoria/acquisition feature flag", () => {
  it("returns 501 when feature disabled", async () => {
    process.env.ACQUISITION_ENABLED = "false";
    const response = await POST(mockRequest);
    expect(response.status).toBe(501);
  });

  it("works normally when feature enabled", async () => {
    process.env.ACQUISITION_ENABLED = "true";
    const response = await POST(mockRequest);
    expect(response.status).not.toBe(501);
  });
});
```

**Tiempo estimado:** 30 minutos

---

## ORDEN SEGURO DE IMPLEMENTACIÓN

### 🔴 CRÍTICO (solo si mentoria_publish_jobs NO existe)
1. **Verificar tabla mentoria_publish_jobs** (5 min)
2. Si NO existe:
   - Aplicar 0162 (legacy sin tenant_id) → 10 min
   - Aplicar 0186 (tenant isolation fix) → 15 min
   - Re-aplicar 0173 (resilience runtime) → 10 min
3. Si existe:
   - Solo aplicar 0186 → 15 min

### 🟡 PREPARACIÓN (cuando feature se vaya a activar)
4. **Fix código** — tenant filters + tipos (20 min)
5. **Feature flag** — safety net temporal (10 min)
6. **Tests** — tenant isolation + feature flag (30 min)

**Total tiempo crítico:** 40-50 minutos (solo si 0173 está roto)  
**Total tiempo preparación:** 60 minutos (cuando se active feature)

---

## VALIDACIÓN POST-FIX

### Queries de Verificación

```sql
-- 1. Verificar tabla existe con tenant_id
PRAGMA table_info(acquisition_posts);
-- Debe incluir: tenant_id TEXT NOT NULL

-- 2. Verificar FK constraint
SELECT sql FROM sqlite_master 
WHERE type='table' AND name='acquisition_posts';
-- Debe incluir: FOREIGN KEY (tenant_id) REFERENCES tenants(id)

-- 3. Verificar tabla está vacía (no hay data legacy)
SELECT COUNT(*) FROM acquisition_posts;
-- Debe retornar: 0

-- 4. Verificar FK de resilience table ahora válida
PRAGMA foreign_key_check(mentoria_publish_jobs);
-- Debe retornar: 0 rows (no FK violations)

-- 5. Verificar indexes
SELECT name FROM sqlite_master 
WHERE type='index' AND tbl_name='acquisition_posts';
-- Debe incluir: idx_acquisition_posts_tenant_channel, idx_acquisition_posts_tenant_metrics
```

### Tests de Runtime

```bash
# 1. Verificar feature flag funciona
curl -X GET https://mentorias.drako.systems/api/mentoria/acquisition \
  -H "Cookie: session=..." \
  -H "Content-Type: application/json"
# Esperado: 501 Not Implemented (si ACQUISITION_ENABLED=false)

# 2. Verificar endpoint funciona cuando habilitado
# (requiere habilitar ACQUISITION_ENABLED=true primero)
curl -X GET https://mentorias.drako.systems/api/mentoria/acquisition \
  -H "Cookie: session=..." \
  -H "Content-Type: application/json"
# Esperado: 200 OK con { ok: true, metrics: {...}, scheduledPosts: [] }

# 3. Verificar tenant isolation
# (requiere crear posts de prueba para diferentes tenants)
```

---

## PLAN DE ROLLBACK

### Si fix de 0186 causa problemas

**Escenario:** Migración aplicada pero algo falla

**Rollback inmediato:**
```sql
BEGIN TRANSACTION;

-- Restaurar tabla backup si existe
DROP TABLE IF EXISTS acquisition_posts;
ALTER TABLE acquisition_posts_backup RENAME TO acquisition_posts;

-- Eliminar indexes nuevos
DROP INDEX IF EXISTS idx_acquisition_posts_tenant_channel;
DROP INDEX IF EXISTS idx_acquisition_posts_tenant_metrics;

COMMIT;
```

**Verificación:**
```sql
PRAGMA table_info(acquisition_posts);
-- NO debe incluir tenant_id
```

### Si código con tenant filters causa crash

**Rollback código:**
1. Revert commit de tenant filters
2. Volver a métodos sin tenantId parameter
3. Deploy nuevo build

**Tiempo:** 10 minutos

### Si feature flag causa confusión

**Acción:**
```bash
# Simplemente deshabilitar flag
ACQUISITION_ENABLED=false
```

**Nota:** Feature ya está "deshabilitada" (no UI), flag es solo safety net adicional.

---

## CONCLUSIONES FINALES

### Diagnóstico
**P0-1 NO es un blocker de producción.**

Es **RUNTIME DRIFT** entre código futurista y schema pendiente de aplicar.

### Causa Raíz
1. Migración 0162 nunca fue aplicada en `saas_mentorias_prod_db`
2. Feature acquisition fue desarrollada pero NO activada en UI
3. Código adelantado respecto a schema deployed

### Riesgo Real
- ❌ **Usuarios:** NINGUNO (feature no expuesta)
- ⚠️ **Admins:** BAJO (solo si acceden manualmente)
- ⚠️ **FK Constraint:** MEDIO (0173 puede estar roto)

### Acción Inmediata Requerida
✅ **Solo si `mentoria_publish_jobs` NO existe:**
- Aplicar 0162 + 0186 + re-aplicar 0173
- Tiempo: 40 minutos

❌ **Si `mentoria_publish_jobs` existe:**
- NO es urgente
- Aplicar 0186 cuando feature se vaya a activar
- Tiempo: 60 minutos cuando corresponda

### Reclasificación
- **Antes:** P0 BLOCKER — Multi-tenant data leakage
- **Ahora:** P2 DEBT — Future feature schema preparation

### Siguiente Paso
**CRÍTICO:** Ejecutar en `saas_mentorias_prod_db`:
```sql
SELECT name FROM sqlite_master WHERE type = 'table' AND name = 'mentoria_publish_jobs';
```

**Si retorna 0 rows** → Aplicar plan CRÍTICO inmediatamente  
**Si retorna 1 row** → Aplicar plan PREPARACIÓN cuando se active feature

---

**Reporte completado en modo READ-ONLY.**  
**Ningún cambio realizado en código, migraciones, bindings ni producción.**
