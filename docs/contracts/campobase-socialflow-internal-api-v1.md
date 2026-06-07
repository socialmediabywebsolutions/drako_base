# Campobase ↔ SocialFlow Internal API Contract v1.0

**Version:** 1.0  
**Date:** 5 de Junio de 2026  
**Status:** DRAFT — Pending Implementation  
**Owner:** Arquitectura Drako  

---

## 1. Purpose

Este contrato define la API interna entre **Campobase** (control plane) y **SocialFlow** (business plane) para:

### Objetivos principales:

1. **Eliminar imports directos** entre Campobase y SocialFlow
   - Actualmente: `src/lib/campobase/socialflow-service.ts` importa directamente de `@/lib/socialflow/contracts/campobase`
   - Objetivo: Sustituir import directo por llamadas HTTP/API

2. **Preparar la separación de SocialFlow a Worker independiente**
   - Fase 1: API interna funciona dentro del monolito Next.js
   - Fase 2: SocialFlow se mueve a Cloudflare Worker
   - Fase 3: Campobase apunta a worker domain

3. **Mantener Campobase como control plane**
   - Campobase orquesta automation de todos los SaaS
   - No debe contener lógica de negocio de SocialFlow
   - Solo coordina, observa y ejecuta operaciones

4. **Mantener SocialFlow como business plane independiente**
   - SocialFlow es dueño de su dominio (posts, campaigns, LinkedIn, analytics)
   - No debe importar lógica interna de Campobase
   - Expone contratos estables para ser orquestado

5. **Permitir evolución gradual**
   - Primero: Implementar endpoints en monolito
   - Luego: Probar API calls en lugar de imports
   - Después: Mover SocialFlow a worker
   - Finalmente: Eliminar código legacy del monolito

---

## 2. Boundary Rules

### Reglas estrictas de separación:

#### ❌ PROHIBIDO:

1. **Campobase NO puede importar `@/lib/socialflow/*`**
   - Violación actual: `src/lib/campobase/socialflow-service.ts` → `@/lib/socialflow/contracts/campobase`
   - Debe usar: API interna HTTP

2. **SocialFlow NO puede importar lógica interna de Campobase**
   - Permitido: Tipos compartidos en `@/lib/capabilities/*`
   - Prohibido: Importar desde `@/lib/campobase/*` o `@/lib/campamento-base/*`

3. **NO usar mocks/demo como sustituto productivo**
   - Demo data solo para tests
   - Nunca en runtime de producción

4. **NO modificar el contrato sin versionado**
   - Cambios breaking requieren v2
   - Cambios aditivos permitidos en v1

#### ✅ PERMITIDO:

1. **Comunicación mediante API interna**
   - HTTP/JSON con auth de servicio
   - Endpoints versionados (`/internal/socialflow/v1/*`)

2. **Eventos asincrónicos**
   - Cloudflare Queues para operaciones pesadas
   - Event log para observabilidad

3. **Health checks y métricas**
   - SocialFlow expone `/health`
   - Campobase monitorea estado

4. **Capabilities compartidas neutrales**
   - `@/lib/capabilities/social-publishing`
   - `@/lib/capabilities/linkedin-oauth` (future)
   - Deben ser product-agnostic

5. **Tipos compartidos estables**
   - Contratos TypeScript en package separado
   - No contienen lógica de negocio

---

## 3. Authentication

### Service Token Authentication

Todos los endpoints internos requieren autenticación de servicio:

```http
Authorization: Bearer <SERVICE_TOKEN>
```

#### Headers obligatorios:

```http
Authorization: Bearer eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9...
X-Drako-Control-Plane: campobase
X-Drako-Request-Id: uuid-v4
X-Drako-Tenant-Id: tenant-123
Content-Type: application/json
```

#### Descripción de headers:

- **Authorization**: JWT service token con scope `internal:socialflow:*`
- **X-Drako-Control-Plane**: Identificador del control plane (siempre `campobase`)
- **X-Drako-Request-Id**: UUID v4 para tracing
- **X-Drako-Tenant-Id**: Tenant context (opcional para algunos endpoints)

#### Token Structure:

```typescript
type ServiceTokenPayload = {
  iss: "campobase";          // issuer
  aud: "socialflow";         // audience
  sub: "service-account";    // subject
  scope: "internal:socialflow:automation internal:socialflow:observability";
  exp: number;               // expiration timestamp
  iat: number;               // issued at timestamp
};
```

#### Error Responses:

**401 Unauthorized:**
```json
{
  "error": "UNAUTHORIZED",
  "message": "Missing or invalid service token",
  "code": "AUTH_TOKEN_MISSING"
}
```

**403 Forbidden:**
```json
{
  "error": "FORBIDDEN",
  "message": "Insufficient permissions for this operation",
  "code": "AUTH_SCOPE_INSUFFICIENT",
  "requiredScope": "internal:socialflow:automation"
}
```

#### Token Rotation:

- Tokens rotan cada 90 días
- Grace period de 7 días para migración
- Almacenados en Cloudflare Workers KV
- Secret name: `SOCIALFLOW_INTERNAL_SERVICE_TOKEN`

#### Environment-specific:

**Local:**
```bash
# .dev.vars
SOCIALFLOW_INTERNAL_SERVICE_TOKEN=dev-token-local-only
```

**Production:**
```bash
# wrangler secret
wrangler secret put SOCIALFLOW_INTERNAL_SERVICE_TOKEN --env production
```

---

## 4. Endpoints v1

### 4.1. GET /internal/socialflow/health

**Purpose:** Health check para verificar si SocialFlow está operativo.

**Method:** `GET`

**Path:** `/internal/socialflow/health`

**Auth:** Required (service token)

**Headers:**
```http
Authorization: Bearer <SERVICE_TOKEN>
X-Drako-Request-Id: <uuid>
```

**Query Params:** None

**Request Body:** None

**Response 200 OK:**
```typescript
{
  "status": "healthy" | "degraded" | "unhealthy",
  "timestamp": "2026-06-05T09:45:00Z",
  "services": {
    "database": "healthy",
    "ai": "healthy",
    "linkedin_oauth": "healthy",
    "scheduler": "healthy"
  },
  "metrics": {
    "uptime_seconds": 86400,
    "requests_last_hour": 1234,
    "errors_last_hour": 5
  }
}
```

**Response 503 Service Unavailable:**
```json
{
  "status": "unhealthy",
  "timestamp": "2026-06-05T09:45:00Z",
  "services": {
    "database": "unhealthy",
    "ai": "degraded",
    "linkedin_oauth": "healthy",
    "scheduler": "healthy"
  },
  "error": "Database connection failed"
}
```

**TypeScript:**
```typescript
type SocialFlowHealthResponse = {
  status: "healthy" | "degraded" | "unhealthy";
  timestamp: string;
  services: {
    database: "healthy" | "degraded" | "unhealthy";
    ai: "healthy" | "degraded" | "unhealthy";
    linkedin_oauth: "healthy" | "degraded" | "unhealthy";
    scheduler: "healthy" | "degraded" | "unhealthy";
  };
  metrics?: {
    uptime_seconds: number;
    requests_last_hour: number;
    errors_last_hour: number;
  };
  error?: string;
};
```

**Idempotency:** GET request (naturally idempotent)

**Example Request:**
```bash
curl -X GET https://socialflow.drako.workers.dev/internal/socialflow/health \
  -H "Authorization: Bearer eyJhbGc..." \
  -H "X-Drako-Request-Id: 550e8400-e29b-41d4-a716-446655440000"
```

---

### 4.2. GET /internal/socialflow/observability/snapshot

**Purpose:** Obtener snapshot de estado operativo de SocialFlow para observabilidad de Campobase.

**Method:** `GET`

**Path:** `/internal/socialflow/observability/snapshot`

**Auth:** Required (service token with scope `internal:socialflow:observability`)

**Headers:**
```http
Authorization: Bearer <SERVICE_TOKEN>
X-Drako-Control-Plane: campobase
X-Drako-Request-Id: <uuid>
X-Drako-Tenant-Id: <tenant-id>
```

**Query Params:**
- `tenantId` (required): Tenant ID
- `saasId` (required): SaaS ID

**Request Body:** None

**Response 200 OK:**
```typescript
{
  "tenantId": "demo-tenant",
  "saasId": "socialflow",
  "timestamp": "2026-06-05T09:45:00Z",
  "automations": {
    "total": 3,
    "enabled": 2,
    "disabled": 1,
    "items": [
      {
        "automationKey": "socialflow.content_generation",
        "displayName": "SocialFlow content generation",
        "enabled": true,
        "lastRun": "2026-06-04T10:00:00Z",
        "status": "SUCCESS"
      }
    ]
  },
  "executions": {
    "running": 0,
    "succeeded": 45,
    "failed": 2,
    "last24h": 5
  },
  "posts": {
    "total": 150,
    "scheduled": 12,
    "published": 138,
    "failed": 0
  },
  "errors": [
    {
      "timestamp": "2026-06-05T08:30:00Z",
      "code": "LINKEDIN_RATE_LIMIT",
      "message": "Rate limit exceeded",
      "severity": "warning"
    }
  ]
}
```

**Response 404 Not Found:**
```json
{
  "error": "NOT_FOUND",
  "message": "No SocialFlow instance found for tenant",
  "code": "SOCIALFLOW_INSTANCE_NOT_FOUND"
}
```

**TypeScript:**
```typescript
type SocialFlowObservabilitySnapshot = {
  tenantId: string;
  saasId: string;
  timestamp: string;
  automations: {
    total: number;
    enabled: number;
    disabled: number;
    items: Array<{
      automationKey: string;
      displayName: string;
      enabled: boolean;
      lastRun: string | null;
      status: "SUCCESS" | "FAILED" | "RUNNING" | null;
    }>;
  };
  executions: {
    running: number;
    succeeded: number;
    failed: number;
    last24h: number;
  };
  posts: {
    total: number;
    scheduled: number;
    published: number;
    failed: number;
  };
  errors: Array<{
    timestamp: string;
    code: string;
    message: string;
    severity: "info" | "warning" | "error" | "critical";
  }>;
};
```

**Idempotency:** GET request (naturally idempotent)

---

### 4.3. POST /internal/socialflow/automation/trigger

**Purpose:** Disparar automation de generación de contenido social desde Campobase.

**Method:** `POST`

**Path:** `/internal/socialflow/automation/trigger`

**Auth:** Required (service token with scope `internal:socialflow:automation`)

**Headers:**
```http
Authorization: Bearer <SERVICE_TOKEN>
X-Drako-Control-Plane: campobase
X-Drako-Request-Id: <uuid>
X-Drako-Tenant-Id: <tenant-id>
X-Drako-Idempotency-Key: <uuid>
Content-Type: application/json
```

**Request Body:**
```typescript
{
  "tenantId": "demo-tenant",
  "saasId": "socialflow",
  "automationKey": "socialflow.content_generation",
  "config": {
    "niche": "SaaS marketing",
    "tone": "professional",
    "frequencyPerWeek": 3
  }
}
```

**Response 200 OK:**
```typescript
{
  "executionId": "exec_550e8400",
  "automationKey": "socialflow.content_generation",
  "status": "RUNNING",
  "startedAt": "2026-06-05T09:45:00Z",
  "estimatedCompletionAt": "2026-06-05T09:47:00Z",
  "result": {
    "campaignId": "camp_abc123",
    "postsCount": 3,
    "scheduledCount": 3,
    "schedule": [
      {
        "postId": "post_001",
        "scheduledAt": "2026-06-06T10:00:00Z"
      },
      {
        "postId": "post_002",
        "scheduledAt": "2026-06-08T10:00:00Z"
      },
      {
        "postId": "post_003",
        "scheduledAt": "2026-06-10T10:00:00Z"
      }
    ]
  }
}
```

**Response 400 Bad Request:**
```json
{
  "error": "INVALID_INPUT",
  "message": "Invalid automation configuration",
  "code": "AUTOMATION_CONFIG_INVALID",
  "details": {
    "field": "config.niche",
    "reason": "Niche is required"
  }
}
```

**Response 409 Conflict:**
```json
{
  "error": "CONFLICT",
  "message": "Automation already running",
  "code": "AUTOMATION_ALREADY_RUNNING",
  "executionId": "exec_existing"
}
```

**Response 503 Service Unavailable:**
```json
{
  "error": "SERVICE_UNAVAILABLE",
  "message": "AI service temporarily unavailable",
  "code": "AI_SERVICE_UNAVAILABLE",
  "retryAfter": 60
}
```

**TypeScript:**
```typescript
type SocialFlowAutomationTriggerRequest = {
  tenantId: string;
  saasId: string;
  automationKey: "socialflow.content_generation" | "socialflow.health_check";
  config: {
    niche: string;
    tone: string;
    frequencyPerWeek: number;
  };
};

type SocialFlowAutomationTriggerResponse = {
  executionId: string;
  automationKey: string;
  status: "RUNNING" | "SUCCESS" | "FAILED";
  startedAt: string;
  estimatedCompletionAt: string | null;
  result: {
    campaignId: string;
    postsCount: number;
    scheduledCount: number;
    schedule: Array<{
      postId: string;
      scheduledAt: string;
    }>;
  } | null;
  error?: string;
};
```

**Idempotency:**
- Idempotent using `X-Drako-Idempotency-Key` header
- Same key within 24h returns cached result
- After 24h, creates new execution

**Example Request:**
```bash
curl -X POST https://socialflow.drako.workers.dev/internal/socialflow/automation/trigger \
  -H "Authorization: Bearer eyJhbGc..." \
  -H "X-Drako-Control-Plane: campobase" \
  -H "X-Drako-Request-Id: 550e8400-e29b-41d4-a716-446655440000" \
  -H "X-Drako-Tenant-Id: demo-tenant" \
  -H "X-Drako-Idempotency-Key: 660f9500-f39c-52e5-b827-557766551111" \
  -H "Content-Type: application/json" \
  -d '{
    "tenantId": "demo-tenant",
    "saasId": "socialflow",
    "automationKey": "socialflow.content_generation",
    "config": {
      "niche": "SaaS marketing",
      "tone": "professional",
      "frequencyPerWeek": 3
    }
  }'
```

---

### 4.4. POST /internal/socialflow/operator/actions

**Purpose:** Ejecutar acciones operativas controladas sobre SocialFlow (enable/disable automation, run specific task).

**Method:** `POST`

**Path:** `/internal/socialflow/operator/actions`

**Auth:** Required (service token with scope `internal:socialflow:operator`)

**Headers:**
```http
Authorization: Bearer <SERVICE_TOKEN>
X-Drako-Control-Plane: campobase
X-Drako-Request-Id: <uuid>
X-Drako-Tenant-Id: <tenant-id>
Content-Type: application/json
```

**Request Body:**
```typescript
{
  "tenantId": "demo-tenant",
  "saasId": "socialflow",
  "action": "ENABLE_AUTOMATION" | "DISABLE_AUTOMATION" | "RUN_ONE" | "CANCEL_EXECUTION",
  "target": {
    "automationKey": "socialflow.content_generation",
    "executionId": "exec_550e8400"
  }
}
```

**Response 200 OK:**
```typescript
{
  "ok": true,
  "action": "ENABLE_AUTOMATION",
  "executionId": "exec_660f9500",
  "message": "Automation enabled successfully",
  "timestamp": "2026-06-05T09:45:00Z"
}
```

**Response 400 Bad Request:**
```json
{
  "error": "INVALID_ACTION",
  "message": "Unknown action type",
  "code": "OPERATOR_ACTION_INVALID"
}
```

**Response 404 Not Found:**
```json
{
  "error": "NOT_FOUND",
  "message": "Automation not found",
  "code": "AUTOMATION_NOT_FOUND"
}
```

**TypeScript:**
```typescript
type SocialFlowOperatorActionRequest = {
  tenantId: string;
  saasId: string;
  action: "ENABLE_AUTOMATION" | "DISABLE_AUTOMATION" | "RUN_ONE" | "CANCEL_EXECUTION";
  target: {
    automationKey?: string;
    executionId?: string;
  };
};

type SocialFlowOperatorActionResponse = {
  ok: boolean;
  action: string;
  executionId: string | null;
  message: string;
  timestamp: string;
  error?: string;
};
```

**Idempotency:** NOT idempotent (state-changing operations)

---

### 4.5. GET /internal/socialflow/owner/snapshot

**Purpose:** Obtener snapshot de métricas de SocialFlow para el Owner Dashboard.

**Method:** `GET`

**Path:** `/internal/socialflow/owner/snapshot`

**Auth:** Required (service token with scope `internal:socialflow:owner`)

**Headers:**
```http
Authorization: Bearer <SERVICE_TOKEN>
X-Drako-Control-Plane: campobase
X-Drako-Request-Id: <uuid>
X-Drako-Tenant-Id: <tenant-id>
```

**Query Params:**
- `tenantId` (required): Tenant ID
- `saasId` (required): SaaS ID

**Request Body:** None

**Response 200 OK:**
```typescript
{
  "tenantId": "demo-tenant",
  "saasId": "socialflow",
  "timestamp": "2026-06-05T09:45:00Z",
  "connectedAccounts": 2,
  "activeCampaigns": 3,
  "publishedPostsLast30Days": 45,
  "scheduledPostsThisWeek": 6,
  "readinessStage": "FIRST_PAYING_USER_READY",
  "healthStatus": "Healthy",
  "metrics": {
    "totalImpressions": 12500,
    "totalEngagements": 850,
    "averageEngagementRate": 6.8
  }
}
```

**Response 404 Not Found:**
```json
{
  "error": "NOT_FOUND",
  "message": "SocialFlow instance not found",
  "code": "SOCIALFLOW_INSTANCE_NOT_FOUND"
}
```

**TypeScript:**
```typescript
type SocialFlowOwnerSnapshotResponse = {
  tenantId: string;
  saasId: string;
  timestamp: string;
  connectedAccounts: number;
  activeCampaigns: number;
  publishedPostsLast30Days: number;
  scheduledPostsThisWeek: number;
  readinessStage: "GUIDED_SETUP" | "PILOT_READY" | "FIRST_PAYING_USER_READY";
  healthStatus: "Healthy" | "Needs attention" | "No live analytics yet";
  metrics: {
    totalImpressions: number;
    totalEngagements: number;
    averageEngagementRate: number;
  };
};
```

**Idempotency:** GET request (naturally idempotent)

**Sustituye:** `import { getSocialOwnerDashboardSnapshot } from "@/lib/socialflow/contracts/owner-dashboard";`

---

### 4.6. POST /internal/socialflow/events

**Purpose:** Registrar eventos relevantes desde el control plane hacia SocialFlow.

**Method:** `POST`

**Path:** `/internal/socialflow/events`

**Auth:** Required (service token)

**Headers:**
```http
Authorization: Bearer <SERVICE_TOKEN>
X-Drako-Control-Plane: campobase
X-Drako-Request-Id: <uuid>
X-Drako-Tenant-Id: <tenant-id>
Content-Type: application/json
```

**Request Body:**
```typescript
{
  "eventType": "socialflow.automation.requested",
  "tenantId": "demo-tenant",
  "saasId": "socialflow",
  "timestamp": "2026-06-05T09:45:00Z",
  "payload": {
    "automationKey": "socialflow.content_generation",
    "requestedBy": "campobase",
    "reason": "scheduled_trigger"
  }
}
```

**Response 202 Accepted:**
```typescript
{
  "eventId": "evt_770fa611",
  "status": "ACCEPTED",
  "timestamp": "2026-06-05T09:45:00Z"
}
```

**TypeScript:**
```typescript
type SocialFlowEventRequest = {
  eventType: string;
  tenantId: string;
  saasId: string;
  timestamp: string;
  payload: Record<string, unknown>;
};

type SocialFlowEventResponse = {
  eventId: string;
  status: "ACCEPTED" | "REJECTED";
  timestamp: string;
  error?: string;
};
```

**Idempotency:** Idempotent (events have unique IDs)

---

## 5. TypeScript Contract

### Shared Types Package

Ubicación propuesta: `@/lib/capabilities/internal-api-types` o package separado `@drako/internal-api-types`

```typescript
// @/lib/capabilities/internal-api-types/socialflow.ts

/**
 * Base error type for all SocialFlow internal API errors
 */
export type InternalApiError = {
  error: string;
  message: string;
  code: string;
  details?: Record<string, unknown>;
  retryAfter?: number;
};

/**
 * Health check response
 */
export type SocialFlowHealthResponse = {
  status: "healthy" | "degraded" | "unhealthy";
  timestamp: string;
  services: {
    database: "healthy" | "degraded" | "unhealthy";
    ai: "healthy" | "degraded" | "unhealthy";
    linkedin_oauth: "healthy" | "degraded" | "unhealthy";
    scheduler: "healthy" | "degraded" | "unhealthy";
  };
  metrics?: {
    uptime_seconds: number;
    requests_last_hour: number;
    errors_last_hour: number;
  };
  error?: string;
};

/**
 * Observability snapshot for Campobase monitoring
 */
export type SocialFlowObservabilitySnapshot = {
  tenantId: string;
  saasId: string;
  timestamp: string;
  automations: {
    total: number;
    enabled: number;
    disabled: number;
    items: Array<{
      automationKey: string;
      displayName: string;
      enabled: boolean;
      lastRun: string | null;
      status: "SUCCESS" | "FAILED" | "RUNNING" | null;
    }>;
  };
  executions: {
    running: number;
    succeeded: number;
    failed: number;
    last24h: number;
  };
  posts: {
    total: number;
    scheduled: number;
    published: number;
    failed: number;
  };
  errors: Array<{
    timestamp: string;
    code: string;
    message: string;
    severity: "info" | "warning" | "error" | "critical";
  }>;
};

/**
 * Automation trigger request
 */
export type SocialFlowAutomationTriggerRequest = {
  tenantId: string;
  saasId: string;
  automationKey: "socialflow.content_generation" | "socialflow.health_check";
  config: {
    niche: string;
    tone: string;
    frequencyPerWeek: number;
  };
};

/**
 * Automation trigger response
 */
export type SocialFlowAutomationTriggerResponse = {
  executionId: string;
  automationKey: string;
  status: "RUNNING" | "SUCCESS" | "FAILED";
  startedAt: string;
  estimatedCompletionAt: string | null;
  result: {
    campaignId: string;
    postsCount: number;
    scheduledCount: number;
    schedule: Array<{
      postId: string;
      scheduledAt: string;
    }>;
  } | null;
  error?: string;
};

/**
 * Operator action request
 */
export type SocialFlowOperatorActionRequest = {
  tenantId: string;
  saasId: string;
  action: "ENABLE_AUTOMATION" | "DISABLE_AUTOMATION" | "RUN_ONE" | "CANCEL_EXECUTION";
  target: {
    automationKey?: string;
    executionId?: string;
  };
};

/**
 * Operator action response
 */
export type SocialFlowOperatorActionResponse = {
  ok: boolean;
  action: string;
  executionId: string | null;
  message: string;
  timestamp: string;
  error?: string;
};

/**
 * Owner dashboard snapshot
 */
export type SocialFlowOwnerSnapshotResponse = {
  tenantId: string;
  saasId: string;
  timestamp: string;
  connectedAccounts: number;
  activeCampaigns: number;
  publishedPostsLast30Days: number;
  scheduledPostsThisWeek: number;
  readinessStage: "GUIDED_SETUP" | "PILOT_READY" | "FIRST_PAYING_USER_READY";
  healthStatus: "Healthy" | "Needs attention" | "No live analytics yet";
  metrics: {
    totalImpressions: number;
    totalEngagements: number;
    averageEngagementRate: number;
  };
};

/**
 * Event registration request
 */
export type SocialFlowEventRequest = {
  eventType: string;
  tenantId: string;
  saasId: string;
  timestamp: string;
  payload: Record<string, unknown>;
};

/**
 * Event registration response
 */
export type SocialFlowEventResponse = {
  eventId: string;
  status: "ACCEPTED" | "REJECTED";
  timestamp: string;
  error?: string;
};
```

---

## 6. Event Contract

### Event Types

SocialFlow emite y consume estos eventos para observabilidad y coordinación asíncrona:

#### 6.1. `socialflow.automation.requested`

**Emitido por:** Campobase  
**Consumido por:** SocialFlow  
**Propósito:** Notificar que se solicitó una automation

**Payload:**
```typescript
{
  eventType: "socialflow.automation.requested",
  tenantId: "demo-tenant",
  saasId: "socialflow",
  timestamp: "2026-06-05T09:45:00Z",
  payload: {
    automationKey: "socialflow.content_generation",
    requestedBy: "campobase",
    reason: "scheduled_trigger" | "manual_trigger" | "api_trigger"
  }
}
```

---

#### 6.2. `socialflow.automation.started`

**Emitido por:** SocialFlow  
**Consumido por:** Campobase (observability)  
**Propósito:** Notificar que automation comenzó ejecución

**Payload:**
```typescript
{
  eventType: "socialflow.automation.started",
  tenantId: "demo-tenant",
  saasId: "socialflow",
  timestamp: "2026-06-05T09:46:00Z",
  payload: {
    executionId: "exec_550e8400",
    automationKey: "socialflow.content_generation",
    estimatedDuration: 120
  }
}
```

---

#### 6.3. `socialflow.automation.completed`

**Emitido por:** SocialFlow  
**Consumido por:** Campobase (observability)  
**Propósito:** Notificar que automation completó exitosamente

**Payload:**
```typescript
{
  eventType: "socialflow.automation.completed",
  tenantId: "demo-tenant",
  saasId: "socialflow",
  timestamp: "2026-06-05T09:48:00Z",
  payload: {
    executionId: "exec_550e8400",
    automationKey: "socialflow.content_generation",
    duration: 115,
    result: {
      campaignId: "camp_abc123",
      postsCount: 3,
      scheduledCount: 3
    }
  }
}
```

---

#### 6.4. `socialflow.automation.failed`

**Emitido por:** SocialFlow  
**Consumido por:** Campobase (observability + alerting)  
**Propósito:** Notificar que automation falló

**Payload:**
```typescript
{
  eventType: "socialflow.automation.failed",
  tenantId: "demo-tenant",
  saasId: "socialflow",
  timestamp: "2026-06-05T09:47:00Z",
  payload: {
    executionId: "exec_550e8400",
    automationKey: "socialflow.content_generation",
    duration: 60,
    error: {
      code: "AI_SERVICE_UNAVAILABLE",
      message: "AI Gateway timeout",
      retryable: true
    }
  }
}
```

---

#### 6.5. `socialflow.health.degraded`

**Emitido por:** SocialFlow  
**Consumido por:** Campobase (alerting)  
**Propósito:** Alertar que SocialFlow está degradado

**Payload:**
```typescript
{
  eventType: "socialflow.health.degraded",
  tenantId: "demo-tenant",
  saasId: "socialflow",
  timestamp: "2026-06-05T09:50:00Z",
  payload: {
    services: {
      database: "healthy",
      ai: "degraded",
      linkedin_oauth: "healthy",
      scheduler: "healthy"
    },
    reason: "AI Gateway response time > 5s",
    severity: "warning"
  }
}
```

---

#### 6.6. `socialflow.owner.snapshot.requested`

**Emitido por:** Campobase / Owner Dashboard  
**Consumido por:** SocialFlow  
**Propósito:** Solicitar snapshot asíncrono para owner dashboard

**Payload:**
```typescript
{
  eventType: "socialflow.owner.snapshot.requested",
  tenantId: "demo-tenant",
  saasId: "socialflow",
  timestamp: "2026-06-05T09:45:00Z",
  payload: {
    requestedBy: "owner-dashboard",
    callbackUrl: "/internal/owner/socialflow-snapshot-callback"
  }
}
```

---

## 7. Migration Strategy

### Phase A — Contract Only (CURRENT)

**Objetivo:** Diseñar y documentar el contrato API sin modificar código.

**Entregables:**
- ✅ Este documento (`docs/contracts/campobase-socialflow-internal-api-v1.md`)
- ✅ TypeScript types documentados
- ✅ Event contract documentado
- ✅ Authentication strategy definida

**Validación:**
- Documento revisado por arquitectura
- Stakeholders aprueban contrato
- TypeScript types validados

**Estado:** ✅ COMPLETADO (este archivo)

---

### Phase B — Local Internal Adapter (Week 1-2)

**Objetivo:** Implementar endpoints internos **dentro del monolito**. SocialFlow todavía en mismo runtime que Campobase.

**Archivos a crear:**
```
src/app/api/internal/socialflow/health/route.ts
src/app/api/internal/socialflow/observability/snapshot/route.ts
src/app/api/internal/socialflow/automation/trigger/route.ts
src/app/api/internal/socialflow/operator/actions/route.ts
src/app/api/internal/socialflow/owner/snapshot/route.ts
src/app/api/internal/socialflow/events/route.ts
src/lib/capabilities/internal-api-types/socialflow.ts
src/lib/capabilities/internal-api-client/socialflow.ts
```

**Validación:**
- `pnpm typecheck` ✓
- `npx vitest run` ✓
- Curl tests locales
- Endpoints retornan 200 OK

**Estado:** PENDING

---

### Phase C — Replace Campobase Direct Import (Week 3-4)

**Objetivo:** Actualizar Campobase para usar API client en vez de import directo.

**Archivos a modificar:**
```
src/lib/campobase/socialflow-service.ts
```

**Cambio específico:**
```typescript
// ANTES (import directo):
import {
  getSocialFlowCampobaseOperatorObservabilityContract,
  runSocialFlowCampobaseAutomationContract,
  runSocialFlowCampobaseOperatorActionContract,
} from "@/lib/socialflow/contracts/campobase";

// DESPUÉS (API client):
import { SocialFlowInternalApiClient } from "@/lib/capabilities/internal-api-client/socialflow";

const client = new SocialFlowInternalApiClient({
  baseUrl: process.env.SOCIALFLOW_INTERNAL_API_URL || "http://localhost:3000",
  serviceToken: process.env.SOCIALFLOW_INTERNAL_SERVICE_TOKEN,
});

const result = await client.triggerAutomation({ tenantId, saasId, ... });
```

**Feature flag:**
```typescript
const USE_SOCIALFLOW_API_CLIENT = process.env.SOCIALFLOW_USE_API_CLIENT === "true";

if (USE_SOCIALFLOW_API_CLIENT) {
  return await client.triggerAutomation(...);
} else {
  return await runSocialFlowCampobaseAutomationContract(...);
}
```

**Validación:**
- `pnpm typecheck` ✓
- `npx vitest run` ✓
- Feature flag OFF: regression tests pass
- Feature flag ON: integration tests pass
- No cambios en comportamiento observado

**Estado:** PENDING

---

### Phase D — Replace Owner Direct Import (Week 5)

**Objetivo:** Actualizar Owner dashboard para usar API client.

**Archivos a modificar:**
```
src/lib/owner/control-dashboard.ts
src/lib/owner/types.ts
```

**Cambio específico:**
```typescript
// ANTES:
import { getSocialOwnerDashboardSnapshot } from "@/lib/socialflow/contracts/owner-dashboard";
import type { SocialOwnerSummary } from "@/lib/socialflow/contracts/owner-dashboard";

// DESPUÉS:
import { SocialFlowInternalApiClient } from "@/lib/capabilities/internal-api-client/socialflow";
import type { SocialFlowOwnerSnapshotResponse as SocialOwnerSummary } from "@/lib/capabilities/internal-api-types/socialflow";

const client = new SocialFlowInternalApiClient(...);
const snapshot = await client.getOwnerSnapshot({ tenantId, saasId });
```

**Validación:**
- `pnpm typecheck` ✓
- Owner dashboard renders correctamente
- Métricas idénticas a versión anterior
- No errores en console

**Estado:** PENDING

---

### Phase E — Move SocialFlow to Worker (Week 6-10)

**Objetivo:** Mover SocialFlow a worker independiente.

**Estructura de worker:**
```
workers/socialflow/
  ├── wrangler.toml
  ├── package.json
  ├── tsconfig.json
  ├── src/
  │   ├── index.ts
  │   ├── lib/
  │   │   └── socialflow/         # copied from src/lib/socialflow
  │   ├── app/
  │   │   ├── api/
  │   │   │   ├── internal/       # internal API endpoints
  │   │   │   └── socialflow/     # public API endpoints
  │   │   └── socialflow/         # app routes
  │   └── components/
  │       └── saas/
  │           └── socialflow/     # UI components
  └── tests/
```

**Bindings:**
```toml
# wrangler.toml
name = "socialflow-worker"
main = "src/index.ts"
compatibility_date = "2026-06-05"

[[d1_databases]]
binding = "SOCIAL_DB"
database_name = "socialflow"
database_id = "..."

[vars]
SOCIALFLOW_INTERNAL_SERVICE_TOKEN = "..."
```

**Update API base URL:**
```typescript
// src/lib/campobase/socialflow-service.ts
const client = new SocialFlowInternalApiClient({
  baseUrl: process.env.SOCIALFLOW_INTERNAL_API_URL || "https://socialflow.drako.workers.dev",
  serviceToken: process.env.SOCIALFLOW_INTERNAL_SERVICE_TOKEN,
});
```

**Validación:**
- Worker build ✓
- Worker typecheck ✓
- Worker tests ✓
- Deploy canary
- Smoke tests pass
- Production traffic 10% → worker
- Monitor errors/latency

**Estado:** PENDING

---

### Phase F — Cleanup Legacy Code (Week 11-12)

**Objetivo:** Eliminar código legacy del monolito después de cutover exitoso.

**Archivos a eliminar:**
```
src/lib/socialflow/                    # TODO entire directory
src/app/api/socialflow/                # TODO entire directory
src/app/socialflow/                    # TODO entire directory
src/components/saas/socialflow/        # TODO entire directory
src/lib/social/linkedin-service.ts     # deprecated facade
src/lib/social/live-publishing.ts      # deprecated facade
src/lib/social/analytics-window.ts     # deprecated facade
src/lib/social/linkedin-connection.ts  # deprecated facade
src/lib/social/scheduler.ts            # deprecated facade
src/lib/social/repository.ts           # deprecated facade
src/lib/social/ai/socialflow-engine.ts # deprecated facade
src/lib/social/linkedin.ts             # deprecated facade
src/lib/social/profile/types.ts        # deprecated facade
src/lib/social/profile/repository.ts   # deprecated facade
```

**Validación:**
- Production stable for 7 days
- Zero SocialFlow errors in monolito logs
- `pnpm typecheck` ✓ (monolito sin SocialFlow)
- `npx vitest run` ✓
- Grep search confirms no imports to deleted files

**Estado:** PENDING

---

## 8. First Implementation Commit Proposal

**Commit Name:** `feat(internal-api): implement SocialFlow health endpoint in monolith`

**Objetivo:**  
Implementar el primer endpoint interno `/internal/socialflow/health` dentro del monolito Next.js para validar el contrato API antes de separar SocialFlow.

**Archivos a crear:**

1. `src/app/api/internal/socialflow/health/route.ts`
   - Implementar endpoint GET
   - Retornar health status
   - Validar service token

2. `src/lib/capabilities/internal-api-types/socialflow.ts`
   - Exportar `SocialFlowHealthResponse` type
   - Exportar `InternalApiError` type

3. `src/lib/capabilities/internal-api-auth/service-token.ts`
   - Implementar `validateServiceToken()`
   - Implementar `extractServiceToken()`

4. `tests/api/internal/socialflow/health.test.ts`
   - Test 200 OK con token válido
   - Test 401 sin token
   - Test 401 con token inválido
   - Test health status = healthy

**Archivos a modificar:**

NINGUNO. Este commit solo crea archivos nuevos.

**Archivos que NO se deben tocar:**

❌ `src/lib/campobase/socialflow-service.ts` — Todavía no se modifica  
❌ `src/lib/socialflow/*` — No tocar lógica de SocialFlow  
❌ `src/lib/owner/*` — No tocar Owner todavía  
❌ Cualquier archivo de Mentoría  
❌ Cualquier archivo de Clinic  
❌ Migraciones  

**Tests nuevos necesarios:**

```typescript
// tests/api/internal/socialflow/health.test.ts
import { describe, it, expect } from "vitest";

describe("GET /api/internal/socialflow/health", () => {
  it("returns 200 OK with valid service token", async () => {
    const response = await fetch("http://localhost:3000/api/internal/socialflow/health", {
      headers: {
        "Authorization": "Bearer valid-token",
        "X-Drako-Request-Id": "test-123",
      },
    });
    
    expect(response.status).toBe(200);
    const body = await response.json();
    expect(body.status).toBe("healthy");
    expect(body.services).toBeDefined();
  });

  it("returns 401 without service token", async () => {
    const response = await fetch("http://localhost:3000/api/internal/socialflow/health");
    expect(response.status).toBe(401);
  });

  it("returns 401 with invalid service token", async () => {
    const response = await fetch("http://localhost:3000/api/internal/socialflow/health", {
      headers: {
        "Authorization": "Bearer invalid-token",
      },
    });
    expect(response.status).toBe(401);
  });
});
```

**Validaciones:**

1. **TypeCheck:**
   ```bash
   pnpm typecheck
   # Expected: exit 0
   ```

2. **Tests:**
   ```bash
   npx vitest run tests/api/internal/socialflow/health.test.ts
   # Expected: 3/3 tests pass
   ```

3. **Manual curl:**
   ```bash
   curl http://localhost:3000/api/internal/socialflow/health \
     -H "Authorization: Bearer dev-token-local" \
     -H "X-Drako-Request-Id: manual-test-001"
   # Expected: 200 OK with JSON body
   ```

4. **Regression:**
   ```bash
   pnpm test
   # Expected: All existing tests still pass
   ```

**Rollback:**

Si algo falla:
```bash
git revert HEAD
rm -rf src/app/api/internal/socialflow
rm -rf src/lib/capabilities/internal-api-types
rm -rf src/lib/capabilities/internal-api-auth
rm -rf tests/api/internal/socialflow
```

**Riesgo:** BAJO
- Solo crea archivos nuevos
- No modifica código existente
- Reversible con git revert
- No afecta producción

---

## 9. Acceptance Criteria

Este contrato se considera **válido y listo para implementar** solo si cumple TODOS estos criterios:

### ✅ Boundary Separation

- [x] Permite eliminar import directo de Campobase → SocialFlow
- [x] Permite eliminar import directo de Owner → SocialFlow
- [x] Define comunicación HTTP/API como único mecanismo
- [x] Prohíbe imports cruzados explícitamente

### ✅ Mock Prevention

- [x] No introduce mocks productivos
- [x] Demo data solo para tests
- [x] Contratos TypeScript basados en producción real

### ✅ Gradual Migration

- [x] Puede funcionar primero dentro del monolito
- [x] Puede apuntar después a Worker
- [x] No requiere big-bang migration
- [x] Permite feature flags para rollout controlado

### ✅ Authentication

- [x] Define auth interna clara (service token)
- [x] Define headers obligatorios
- [x] Define errores 401/403
- [x] Define rotación de token
- [x] Separa entorno local y producción

### ✅ Error Handling

- [x] Define errores HTTP estándar (400, 401, 403, 404, 409, 503)
- [x] Define códigos de error específicos
- [x] Define retry logic cuando aplique
- [x] Define idempotencia cuando aplique

### ✅ TypeScript Completeness

- [x] Tipos definidos para todos los endpoints
- [x] Request/Response types completos
- [x] Error types definidos
- [x] Event types definidos
- [x] No usa `any` o `unknown` sin validación

### ✅ Implementation Readiness

- [x] Primer commit definido y ejecutable
- [x] Tests requeridos documentados
- [x] Validaciones claras
- [x] Rollback strategy definido
- [x] Archivos a crear/modificar/no-tocar especificados

---

## CONFIRMACIÓN FINAL

✅ **Archivo creado:** SÍ  
✅ **Ruta exacta:** `docs/contracts/campobase-socialflow-internal-api-v1.md`

✅ **Endpoints definidos:** 6
1. GET /internal/socialflow/health
2. GET /internal/socialflow/observability/snapshot
3. POST /internal/socialflow/automation/trigger
4. POST /internal/socialflow/operator/actions
5. GET /internal/socialflow/owner/snapshot
6. POST /internal/socialflow/events

✅ **Tipos definidos:** 9
1. InternalApiError
2. SocialFlowHealthResponse
3. SocialFlowObservabilitySnapshot
4. SocialFlowAutomationTriggerRequest
5. SocialFlowAutomationTriggerResponse
6. SocialFlowOperatorActionRequest
7. SocialFlowOperatorActionResponse
8. SocialFlowOwnerSnapshotResponse
9. SocialFlowEventRequest
10. SocialFlowEventResponse

✅ **Siguiente commit recomendado:**  
`feat(internal-api): implement SocialFlow health endpoint in monolith`

**Estado:** Contrato documentado y listo para implementación en Phase B.
