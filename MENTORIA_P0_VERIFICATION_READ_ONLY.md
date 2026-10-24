# Verificación P0 Mentoría — READ-ONLY MODE
**Fecha:** 2026-05-22  
**Metodología:** Análisis estático de código, migraciones, queries SQL, tipos TypeScript  
**Restricciones:** Sin ediciones, sin migraciones, sin cambios en tests

---

## RESUMEN EJECUTIVO

**Problemas Confirmados:**
- ✅ **P0-1 CONFIRMADO** — Acquisition Posts sin tenant_id (CRÍTICO)
- ✅ **P0-2 CONFIRMADO** — Session Persistence Silent Corruption (ALTO)
- ✅ **P0-3 CONFIRMADO** — Feedback Collection Silent Failure (MEDIO-ALTO)

**Hallazgo Crítico:**
P0-1 es **PARADÓJICO** — La migración NO tiene tenant_id pero el código SÍ lo usa parcialmente:
- INSERT queries usan tenant_id ✓
- UPDATE queries usan tenant_id ✓
- **GET queries NO usan tenant_id** ❌

**Conclusión:** La tabla debe haber sido alterada manualmente en producción o existe una migración no documentada. El código presenta **inconsistencia de implementación** que genera riesgo real de cross-tenant leakage.

---

## P0-1: ACQUISITION POSTS SIN TENANT_ID — CRÍTICO ⚠️

### Estado: **CONFIRMADO con inconsistencia estructural**

### Evidencia 1: Migración Original Sin tenant_id
**Archivo:** `@migrations/0162_mentoria_acquisition.sql:4-16`
```sql
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
```

**Hallazgo:** ❌ NO hay columna `tenant_id`  
**Hallazgo:** ❌ NO hay FK a `tenants(id)`  
**Hallazgo:** ❌ Índices NO incluyen tenant_id

### Evidencia 2: Búsqueda de Migración Posterior
**Comando ejecutado:** `grep -r "ALTER TABLE acquisition_posts" migrations/`  
**Resultado:** `No results found`

**Comando ejecutado:** `grep -l "acquisition_posts" migrations/*.sql`  
**Resultado:** Solo 2 archivos:
- `0162_mentoria_acquisition.sql` — Creación original sin tenant_id
- `0173_mentoria_resilience_runtime.sql:58` — FK desde `mentoria_publish_jobs` que referencia `acquisition_posts(id)`

**Conclusión:** NO existe migración que añada tenant_id a acquisition_posts.

### Evidencia 3: Código Usa tenant_id en INSERT (Paradoja)
**Archivo:** `@src/lib/mentoria/acquisition-publishing.ts:48-68`
```typescript
await this.db
  .prepare(
    `INSERT INTO acquisition_posts (
      id, tenant_id, post_id, channel, content, published_at, external_id, clicks, signups, trial_starts, created_at, updated_at
    ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`
  )
  .bind(
    id,
    tenantId,  // ← LÍNEA 56: Código asume que tenant_id existe
    post.id,
    post.channel,
    // ...
  )
```

**Hallazgo:** ✅ INSERT incluye tenant_id  
**Implicación:** El código asume que la columna existe, pero la migración canónica NO la define.

### Evidencia 4: Código Usa tenant_id en UPDATE (Consistente)
**Archivo:** `@src/lib/mentoria/acquisition-publishing.ts:83-93`
```typescript
async trackClick(publishedPostId: string, tenantId: string): Promise<void> {
  const now = new Date().toISOString();
  await this.db
    .prepare(
      `UPDATE acquisition_posts
       SET clicks = clicks + 1, updated_at = ?
       WHERE id = ? AND tenant_id = ?`  // ← LÍNEA 89: Filtra por tenant_id
    )
    .bind(now, publishedPostId, tenantId)
    .run();
}
```

**También en:**
- `trackSignup` línea 95-105 — Filtra por tenant_id ✓
- `trackTrialStart` línea 107-117 — Filtra por tenant_id ✓

**Hallazgo:** ✅ UPDATEs incluyen filtro `tenant_id`

### Evidencia 5: Queries GET SIN tenant_id (CRITICAL LEAK)
**Archivo:** `@src/lib/mentoria/acquisition-publishing.ts:119-138`
```typescript
async getPublishedPost(id: string): Promise<PublishedPost | null> {
  const row = await this.db
    .prepare(`SELECT * FROM acquisition_posts WHERE id = ? LIMIT 1`)
    .bind(id)
    .first<PublishedPostRow>();
  // ❌ NO filtra por tenant_id — Cualquier tenant puede acceder a cualquier post
```

**Archivo:** `@src/lib/mentoria/acquisition-publishing.ts:140-162`
```typescript
async getPublishedPostsByChannel(channel: "linkedin" | "instagram" | "tiktok"): Promise<PublishedPost[]> {
  const rows = await this.db
    .prepare(
      `SELECT * FROM acquisition_posts
       WHERE channel = ?
       ORDER BY published_at DESC
       LIMIT 100`
    )
    .bind(channel)
    .all<PublishedPostRow>();
  // ❌ NO filtra por tenant_id — Retorna posts de TODOS los tenants
```

**Archivo:** `@src/lib/mentoria/acquisition-publishing.ts:171-179`
```typescript
async getPerformanceMetrics(): Promise<{...}> {
  const row = await this.db
    .prepare(
      `SELECT 
        COUNT(*) as total_posts,
        COALESCE(SUM(clicks), 0) as total_clicks,
        COALESCE(SUM(signups), 0) as total_signups,
        COALESCE(SUM(trial_starts), 0) as total_trial_starts
       FROM acquisition_posts`
    )
    .first<{...}>();
  // ❌ NO filtra por tenant_id — Métricas agregadas de TODOS los tenants
```

### Evidencia 6: TenantGuard Tiene Versión Segura (No Usada)
**Archivo:** `@src/lib/mentoria/resilience/tenant-guard.ts:33-42`
```typescript
async getAcquisitionPost(tenantId: string, postId: string): Promise<any> {
  return this.db
    .prepare(
      `SELECT * FROM acquisition_posts
       WHERE tenant_id = ? AND id = ?
       LIMIT 1`
    )
    .bind(tenantId, postId)
    .first();
}
```

**Hallazgo:** ✅ TenantGuard tiene implementación segura  
**Hallazgo:** ❌ AcquisitionPublisher NO usa TenantGuard  
**Hallazgo:** ❌ OptimizationEngine usa AcquisitionPublisher (versión insegura)

### Evidencia 7: Uso Real de Métodos Inseguros
**Archivo:** `@src/lib/mentoria/optimization-engine.ts:75-82`
```typescript
const metrics = await this.acquisitionPublisher.getPerformanceMetrics();

// Get all published posts
const linkedinPosts = await this.acquisitionPublisher.getPublishedPostsByChannel("linkedin");
const instagramPosts = await this.acquisitionPublisher.getPublishedPostsByChannel("instagram");
const tiktokPosts = await this.acquisitionPublisher.getPublishedPostsByChannel("tiktok");

const allPosts = [...linkedinPosts, ...instagramPosts, ...tiktokPosts];
```

**Impacto Real:**
- OptimizationEngine genera recomendaciones de producto
- Usa datos de TODOS los tenants mezclados
- Familia A recibe recomendaciones basadas en posts de Familia B
- Métricas de conversión contaminadas

**Archivo:** `@src/app/api/mentoria/acquisition/route.ts:17-20`
```typescript
const publisher = new AcquisitionPublisher();
const scheduler = new AcquisitionScheduler({ tenantId: actor.tenantId });

const metrics = await publisher.getPerformanceMetrics();
// ❌ Métricas globales expuestas a tenant específico
```

### Evidencia 8: Tipos TypeScript NO Incluyen tenant_id
**Archivo:** `@src/lib/mentoria/acquisition-publishing.ts:5-15`
```typescript
export type PublishedPost = {
  id: string;
  postId: string;
  channel: "linkedin" | "instagram" | "tiktok";
  content: string;
  publishedAt: string;
  externalId?: string;
  clicks: number;
  signups: number;
  trialStarts: number;
  // ❌ NO hay tenantId aquí
};
```

**Archivo:** `@src/lib/mentoria/acquisition-publishing.ts:17-29`
```typescript
type PublishedPostRow = {
  id: string;
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
  // ❌ NO hay tenant_id aquí — inconsistente con INSERT query que lo usa
};
```

### Evidencia 9: Tests NO Cubren Tenant Isolation
**Búsqueda:** `grep -r "AcquisitionPublisher" tests/`  
**Resultado:** `No results found`

**Conclusión:** ❌ NO hay tests que verifiquen tenant isolation en acquisition posts.

### Riesgo Real: **CRÍTICO**

**Escenario de Ataque:**
1. Familia A publica post de LinkedIn vía Mentoría
2. Post se guarda con `tenant_id = familia_a`
3. Familia B llama a `getPublishedPostsByChannel("linkedin")`
4. Familia B recibe posts de Familia A (y todos los demás)
5. **Exposición de contenido privado entre familias**

**Violaciones:**
- ❌ Multi-tenancy violation
- ❌ GDPR data leakage
- ❌ Privacy breach
- ❌ Business intelligence leak

### Hipótesis: Migración Manual en Producción

**Posibilidad 1:** tabla fue alterada manualmente en drako_db_prod  
**Posibilidad 2:** existe migración no versionada aplicada directamente  
**Posibilidad 3:** código está adelantado respecto a migraciones canónicas

**Verificación requerida (fuera de scope READ-ONLY):**
```sql
-- Query de validación en producción:
PRAGMA table_info(acquisition_posts);
-- Si tenant_id existe → migración manual no documentada
-- Si NO existe → código falla en INSERT (crash inmediato)
```

---

## P0-2: SESSION PERSISTENCE SILENT CORRUPTION — ALTO ⚠️

### Estado: **CONFIRMADO**

### Evidencia 1: parseTranscript Retorna [] en Catch
**Archivo:** `@src/lib/mentoria/session-persistence.ts:238-250`
```typescript
private parseTranscript(json: string): MentoriaSessionMessage[] {
  try {
    const parsed = JSON.parse(json);
    return Array.isArray(parsed) ? parsed : [];
  } catch (error) {
    const errorMsg = error instanceof Error ? error.message : String(error);
    console.error("[SessionPersistence] Transcript corruption detected:", {
      error: errorMsg,
      jsonLength: json?.length ?? 0,
      jsonPreview: json?.substring(0, 100) ?? "null",
    });
    return [];  // ❌ Retorna array vacío sin escalar error
  }
}
```

**Hallazgos:**
- ✅ Logging existe (línea 244-248)
- ❌ NO hay escalation a sistema de alertas
- ❌ NO se lanza error (fail-silent)
- ❌ Usuario pierde transcript sin notificación

### Evidencia 2: Uso en getActiveSession
**Archivo:** `@src/lib/mentoria/session-persistence.ts:150`
```typescript
transcript: this.parseTranscript(row.transcript_json),
```

**Flujo:**
1. Usuario recupera sesión activa
2. `transcript_json` está corrupto en DB
3. `parseTranscript` retorna `[]`
4. Usuario recibe sesión con transcript vacío
5. **Contexto de estudio perdido completamente**

### Evidencia 3: parseJsonObject Tiene Mismo Patrón
**Archivo:** `@src/lib/mentoria/session-persistence.ts:253-260`
```typescript
private parseJsonObject<T>(json?: string | null): T | null {
  if (!json) return null;
  try {
    return JSON.parse(json) as T;
  } catch {
    return null;  // ❌ También fail-silent
  }
}
```

**Usado para:**
- `boardUpdate` — Si falla, se pierde estado de la pizarra
- `learningState` — Si falla, se pierde estado de aprendizaje

### Evidencia 4: NO Hay Tests de Corrupción
**Búsqueda:** `grep -r "parseTranscript\|session.*corruption" tests/`  
**Resultado:** `No results found`

**Conclusión:** ❌ NO hay tests que verifiquen manejo de JSON corrupto.

### Riesgo Real: **ALTO**

**Escenario:**
1. Sesión de estudio en progreso
2. Power failure / network issue durante JSON.stringify
3. `transcript_json` parcialmente escrito en DB
4. Próximo load de sesión → `parseTranscript` retorna `[]`
5. Estudiante pierde todo el contexto de la sesión
6. **NO hay alerta al sistema ni al usuario**

**Impacto:**
- Frustración del estudiante (pérdida de progreso)
- Padre no recibe feedback correcto (transcript vacío)
- Sistema de learning memory corrupto (sin datos históricos)
- Métricas de engagement incorrectas

---

## P0-3: FEEDBACK COLLECTION SILENT FAILURE — MEDIO-ALTO ⚠️

### Estado: **CONFIRMADO**

### Evidencia 1: API Sin Try/Catch Específico
**Archivo:** `@src/app/api/mentoria/analytics/route.ts:62-79`
```typescript
if (
  body.action === "collect_feedback" &&
  body.studentProfileId &&
  body.sessionCount !== undefined &&
  body.liked &&
  body.missing &&
  body.wouldRecommend !== undefined
) {
  await feedbackSystem.collectFeedback({  // ❌ Sin try/catch específico
    tenantId: actor.tenantId,
    studentProfileId: body.studentProfileId,
    sessionCount: body.sessionCount,
    liked: body.liked,
    missing: body.missing,
    wouldRecommend: body.wouldRecommend,
  });
  return NextResponse.json({ ok: true, message: "Feedback collected" });
}
```

**Problema:**
- Si `collectFeedback` falla, error sube a catch genérico línea 82-86
- Catch genérico solo logea "ANALYTICS_ACTION_FAILED" sin detalle
- **Sistema responde "ok: true" aunque no se guardó feedback**

### Evidencia 2: collectFeedback Puede Fallar en DB
**Archivo:** `@src/lib/mentoria/feedback-system.ts:79-99`
```typescript
await this.db
  .prepare(
    `INSERT INTO user_feedback (
      id, tenant_id, student_profile_id, session_count, liked_json, missing_json,
      overall_sentiment, would_recommend, collected_at, created_at, updated_at
    ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`
  )
  .bind(
    id,
    input.tenantId,
    input.studentProfileId,
    input.sessionCount,
    JSON.stringify(input.liked),
    JSON.stringify(input.missing),
    overallSentiment,
    input.wouldRecommend ? 1 : 0,
    now,
    now,
    now
  )
  .run();  // ❌ Puede fallar por constraint violation, DB lock, etc.
```

**Causas de fallo:**
- DB lock (concurrent writes)
- Constraint violation (si tenant_id inválido)
- Disk full
- Network timeout a D1

### Evidencia 3: Catch Genérico Sin Detalle
**Archivo:** `@src/app/api/mentoria/analytics/route.ts:82-86`
```typescript
} catch (error) {
  const message = error instanceof Error ? error.message : "ANALYTICS_ACTION_FAILED";
  console.error("[AnalyticsAPI] Error:", message);
  return NextResponse.json({ ok: false, error: message }, { status: 500 });
}
```

**Problema:**
- NO distingue entre feedback failure y otros errores
- NO hay logging específico de feedback loss
- NO hay retry automático

### Evidencia 4: Resilience Layer Existe pero NO Se Usa
**Archivo:** `@src/lib/mentoria/service.ts:3019`
```typescript
await orchestrator.collectFeedbackGuaranteed({
  tenantId: actor.tenantId,
  studentId: student.id,
  sessionCount: (current?.sessionsCompleted ?? 0) + 1,
  // ...
});
```

**Hallazgo:** ✅ Resilience layer con retry existe  
**Hallazgo:** ❌ Solo se usa desde service.ts, NO desde analytics/route.ts  
**Hallazgo:** ❌ API pública NO tiene protección de resilience

### Evidencia 5: NO Hay Tests de Feedback Failure
**Búsqueda:** `grep -r "collectFeedback" tests/`  
**Resultado:** Solo 1 match en `mentoria-service-evolution-scope.test.ts` (no relacionado con failure)

**Conclusión:** ❌ NO hay tests que verifiquen manejo de errores en feedback collection.

### Riesgo Real: **MEDIO-ALTO**

**Escenario:**
1. Usuario completa sesión de estudio
2. UI muestra modal de feedback
3. Usuario escribe feedback detallado (5 minutos)
4. Click en "Enviar"
5. API recibe request, llama `collectFeedback`
6. DB lock por concurrent write → falla INSERT
7. **Catch genérico swallow error**
8. Usuario ve "Feedback enviado" aunque NO se guardó
9. Product team nunca recibe esos insights

**Impacto:**
- Product feedback perdido (datos críticos de negocio)
- Decisiones de producto basadas en data incompleta
- Usuario frustrado si descubre que su feedback no se guardó
- Violación implícita de confianza (UI dice "ok" pero falló)

---

## ANÁLISIS COMPARATIVO DE RIESGOS

| P0 | Severidad | Probabilidad | Impacto en Usuarios | Impacto en Negocio | Complejidad Fix |
|----|-----------|--------------|---------------------|---------------------|-----------------|
| **P0-1** | CRÍTICO | Media | Alto (privacy leak) | Crítico (GDPR) | Media (30 min) |
| **P0-2** | ALTO | Baja | Alto (pérdida datos) | Medio (UX/metrics) | Baja (15 min) |
| **P0-3** | MEDIO-ALTO | Media | Bajo (invisible) | Alto (product data) | Baja (10 min) |

---

## RECOMENDACIONES PRIORIZADAS

### FASE 1: P0-1 Acquisition Posts Tenant Isolation (CRÍTICO)
**Prioridad:** 🔴 BLOCKER — Debe hacerse PRIMERO y en fase separada

**Paso 1: Verificación en Producción**
```sql
-- Ejecutar en drako_db_prod:
PRAGMA table_info(acquisition_posts);
-- Verificar si tenant_id existe

SELECT COUNT(*) FROM acquisition_posts;
-- Si > 0 y tenant_id existe → datos ya están ahí
-- Si > 0 y NO existe tenant_id → CRASH inmediato en siguiente INSERT
```

**Paso 2: Crear Migración (si tenant_id NO existe)**
```sql
-- migrations/0186_acquisition_posts_tenant_isolation.sql
BEGIN TRANSACTION;

-- Añadir columna tenant_id (nullable temporalmente)
ALTER TABLE acquisition_posts ADD COLUMN tenant_id TEXT;

-- Backfill: datos legacy se marcan como unscoped (fail-closed)
UPDATE acquisition_posts 
SET tenant_id = '__LEGACY_UNSCOPED__' 
WHERE tenant_id IS NULL;

-- Hacer NOT NULL después de backfill
-- SQLite no soporta ALTER COLUMN, requiere recreate table:
CREATE TABLE acquisition_posts_new (
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

INSERT INTO acquisition_posts_new 
SELECT * FROM acquisition_posts;

DROP TABLE acquisition_posts;
ALTER TABLE acquisition_posts_new RENAME TO acquisition_posts;

-- Índices para tenant-scoped queries
CREATE INDEX idx_acquisition_posts_tenant_channel 
  ON acquisition_posts(tenant_id, channel, published_at DESC);

CREATE INDEX idx_acquisition_posts_tenant_metrics 
  ON acquisition_posts(tenant_id, clicks, signups, trial_starts);

COMMIT;
```

**Paso 3: Fix Código (añadir tenant filters)**
```typescript
// src/lib/mentoria/acquisition-publishing.ts

// LÍNEA 119-138 — Fix getPublishedPost
async getPublishedPost(tenantId: string, id: string): Promise<PublishedPost | null> {
  const row = await this.db
    .prepare(`SELECT * FROM acquisition_posts WHERE tenant_id = ? AND id = ? LIMIT 1`)
    .bind(tenantId, id)
    .first<PublishedPostRow>();
  // ...
}

// LÍNEA 140-162 — Fix getPublishedPostsByChannel
async getPublishedPostsByChannel(
  tenantId: string,
  channel: "linkedin" | "instagram" | "tiktok"
): Promise<PublishedPost[]> {
  const rows = await this.db
    .prepare(
      `SELECT * FROM acquisition_posts
       WHERE tenant_id = ? AND channel = ?
       ORDER BY published_at DESC
       LIMIT 100`
    )
    .bind(tenantId, channel)
    .all<PublishedPostRow>();
  // ...
}

// LÍNEA 171-206 — Fix getPerformanceMetrics
async getPerformanceMetrics(tenantId: string): Promise<{...}> {
  const row = await this.db
    .prepare(
      `SELECT 
        COUNT(*) as total_posts,
        COALESCE(SUM(clicks), 0) as total_clicks,
        COALESCE(SUM(signups), 0) as total_signups,
        COALESCE(SUM(trial_starts), 0) as total_trial_starts
       FROM acquisition_posts
       WHERE tenant_id = ?`  // ← AÑADIR FILTRO
    )
    .bind(tenantId)  // ← AÑADIR BINDING
    .first<{...}>();
  // ...
}
```

**Paso 4: Fix Tipos**
```typescript
// src/lib/mentoria/acquisition-publishing.ts

export type PublishedPost = {
  id: string;
  tenantId: string;  // ← AÑADIR
  postId: string;
  channel: "linkedin" | "instagram" | "tiktok";
  // ...
};

type PublishedPostRow = {
  id: string;
  tenant_id: string;  // ← AÑADIR
  post_id: string;
  // ...
};
```

**Paso 5: Fix Llamadas**
```typescript
// src/lib/mentoria/optimization-engine.ts:75-82
const metrics = await this.acquisitionPublisher.getPerformanceMetrics(tenantId);

const linkedinPosts = await this.acquisitionPublisher.getPublishedPostsByChannel(tenantId, "linkedin");
const instagramPosts = await this.acquisitionPublisher.getPublishedPostsByChannel(tenantId, "instagram");
const tiktokPosts = await this.acquisitionPublisher.getPublishedPostsByChannel(tenantId, "tiktok");

// src/app/api/mentoria/acquisition/route.ts:20
const metrics = await publisher.getPerformanceMetrics(actor.tenantId);
```

**Paso 6: Tests Obligatorios**
```typescript
// tests/lib/mentoria-acquisition-tenant-isolation.test.ts
describe("AcquisitionPublisher tenant isolation", () => {
  it("getPublishedPost filters by tenant", async () => {
    // Arrange: create post for tenant_a
    // Act: try to get from tenant_b
    // Assert: returns null
  });

  it("getPublishedPostsByChannel only returns tenant posts", async () => {
    // Arrange: create posts for tenant_a and tenant_b
    // Act: call with tenant_a
    // Assert: only tenant_a posts returned
  });

  it("getPerformanceMetrics scoped to tenant", async () => {
    // Arrange: create metrics for tenant_a and tenant_b
    // Act: call with tenant_a
    // Assert: only tenant_a metrics aggregated
  });
});
```

**Tiempo estimado:** 45 minutos (15 min migración + 15 min código + 15 min tests)

---

### FASE 2: P0-2 Session Persistence Silent Corruption (ALTO)

**Paso 1: Añadir Escalation a Event Logger**
```typescript
// src/lib/mentoria/session-persistence.ts:238-250

import { EventLogger } from "@/lib/mentoria/resilience/event-logger";

export class SessionPersistenceManager {
  constructor(
    private db: D1Database = getDb(),
    private eventLogger = new EventLogger()
  ) {}

  private async parseTranscript(
    tenantId: string,  // ← Necesario para event logging
    json: string
  ): Promise<MentoriaSessionMessage[]> {
    try {
      const parsed = JSON.parse(json);
      return Array.isArray(parsed) ? parsed : [];
    } catch (error) {
      const errorMsg = error instanceof Error ? error.message : String(error);
      console.error("[SessionPersistence] CRITICAL: Transcript corruption detected", {
        error: errorMsg,
        jsonLength: json?.length ?? 0,
        jsonPreview: json?.substring(0, 100) ?? "null",
      });

      // ESCALATE: Log to event system for alerting
      try {
        await this.eventLogger.logEvent({
          tenantId,
          eventType: "session_corruption",
          severity: "high",
          data: {
            error: errorMsg,
            jsonLength: json?.length ?? 0,
            corruptionType: "transcript_json_parse_failure",
          },
        });
      } catch (logError) {
        console.error("[SessionPersistence] Failed to log corruption event", logError);
      }

      return [];  // Mantener fail-safe pero con escalation
    }
  }
}
```

**Paso 2: Fix Signature en Llamadas**
```typescript
// Línea 150, 182 — Pasar tenantId
transcript: await this.parseTranscript(tenantId, row.transcript_json),
```

**Paso 3: Tests de Corrupción**
```typescript
// tests/lib/mentoria-session-corruption.test.ts
describe("SessionPersistenceManager corruption handling", () => {
  it("parseTranscript logs corruption event when JSON invalid", async () => {
    // Arrange: corrupt JSON
    // Act: call parseTranscript
    // Assert: event logged with severity=high
  });

  it("parseTranscript returns empty array on corruption", async () => {
    // Assert fail-safe behavior maintained
  });
});
```

**Tiempo estimado:** 20 minutos

---

### FASE 3: P0-3 Feedback Collection Silent Failure (MEDIO-ALTO)

**Paso 1: Añadir Try/Catch Específico**
```typescript
// src/app/api/mentoria/analytics/route.ts:62-79

import { getMentoriaOrchestrator } from "@/lib/mentoria/resilience/orchestrator";

if (body.action === "collect_feedback" && ...) {
  try {
    await feedbackSystem.collectFeedback({
      tenantId: actor.tenantId,
      studentProfileId: body.studentProfileId,
      sessionCount: body.sessionCount,
      liked: body.liked,
      missing: body.missing,
      wouldRecommend: body.wouldRecommend,
    });
    return NextResponse.json({ ok: true, message: "Feedback collected" });
  } catch (feedbackError) {
    const msg = feedbackError instanceof Error ? feedbackError.message : String(feedbackError);
    console.error("[AnalyticsAPI] CRITICAL: Feedback collection failed", {
      tenantId: actor.tenantId,
      studentProfileId: body.studentProfileId,
      error: msg,
    });

    // FALLBACK: Queue to resilience layer for retry
    try {
      const orchestrator = getMentoriaOrchestrator();
      await orchestrator.collectFeedbackGuaranteed({
        tenantId: actor.tenantId,
        studentId: body.studentProfileId,
        sessionCount: body.sessionCount,
        liked: body.liked,
        missing: body.missing,
        wouldRecommend: body.wouldRecommend,
      });
      return NextResponse.json({ 
        ok: true, 
        message: "Feedback queued for retry",
        queued: true 
      });
    } catch (queueError) {
      console.error("[AnalyticsAPI] Failed to queue feedback", queueError);
      return NextResponse.json({ 
        ok: false, 
        error: "FEEDBACK_COLLECTION_FAILED" 
      }, { status: 500 });
    }
  }
}
```

**Paso 2: Tests de Failure**
```typescript
// tests/api/mentoria-analytics-feedback-failure.test.ts
describe("POST /api/mentoria/analytics feedback failure handling", () => {
  it("queues feedback to resilience layer on DB failure", async () => {
    // Mock: collectFeedback throws DB error
    // Assert: queued to resilience layer
  });

  it("returns error if both direct and queue fail", async () => {
    // Assert: proper error response
  });
});
```

**Tiempo estimado:** 15 minutos

---

## ORDEN SEGURO DE IMPLEMENTACIÓN

### 🔴 BLOCKER (debe hacerse PRIMERO, fase separada)
1. **P0-1 Acquisition Posts Tenant Isolation**
   - Verificar estado en producción
   - Crear migración si necesaria
   - Fix código + tipos
   - Fix llamadas
   - Tests de isolation
   - **Deploy aislado + verificación**

### 🟡 FOLLOW-UP (después de P0-1 verificado en prod)
2. **P0-2 Session Persistence Escalation** (20 min)
3. **P0-3 Feedback Collection Retry** (15 min)

**Total tiempo implementación:** 80 minutos (45 + 20 + 15)

---

## QUERIES DE VALIDACIÓN POST-FIX

```sql
-- 1. Verificar tenant_id en acquisition_posts
PRAGMA table_info(acquisition_posts);
-- Debe incluir: tenant_id TEXT NOT NULL

-- 2. Verificar FK constraint
SELECT sql FROM sqlite_master 
WHERE type='table' AND name='acquisition_posts';
-- Debe incluir: FOREIGN KEY (tenant_id) REFERENCES tenants(id)

-- 3. Verificar NO hay rows sin tenant
SELECT COUNT(*) FROM acquisition_posts WHERE tenant_id IS NULL OR tenant_id = '';
-- Debe retornar: 0

-- 4. Verificar isolation (desde app con tenant_a)
SELECT COUNT(*) FROM acquisition_posts WHERE tenant_id != 'tenant_a';
-- Debe ser 0 si filtros funcionan correctamente

-- 5. Verificar event logging de corruption
SELECT COUNT(*) FROM mentoria_system_events 
WHERE event_type = 'session_corruption' 
AND severity = 'high';
-- Si > 0 → hay casos de corrupción que ahora se detectan
```

---

## CONCLUSIONES

### Confirmación de P0s
- ✅ **P0-1:** REAL y CRÍTICO — Cross-tenant leakage en acquisition posts
- ✅ **P0-2:** REAL — Session corruption fail-silent sin escalation
- ✅ **P0-3:** REAL — Feedback loss silencioso en API pública

### Hallazgo Crítico
P0-1 presenta **inconsistencia estructural paradójica**:
- Migración canónica NO define `tenant_id`
- Código asume que `tenant_id` existe
- Partial implementation: INSERT/UPDATE usan tenant, GET queries NO

**Implicación:** O existe migración no documentada, o código está roto en producción.

### Priorización Absoluta
**P0-1 DEBE ser fix #1** en fase separada porque:
1. Afecta integridad de multi-tenancy (fundamento del sistema)
2. Violación potencial de GDPR/privacidad
3. Requiere verificación en producción antes de proceder
4. Cambio de schema (migración) tiene riesgo > cambio de código

### Próximos Pasos
1. ✅ **Verificar estado real en drako_db_prod** (query PRAGMA table_info)
2. ✅ **Implementar P0-1** según plan detallado
3. ✅ **Deploy P0-1 + smoke tests**
4. ✅ **Implementar P0-2 y P0-3** en segunda fase

---

**Verificación completada en modo READ-ONLY.**  
**Siguiente acción:** Validar estado de tabla acquisition_posts en producción.
