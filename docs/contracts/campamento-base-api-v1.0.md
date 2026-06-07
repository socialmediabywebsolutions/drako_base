# 🔌 Campamento Base API Contract v1.0

**Versión:** 1.0.0  
**Fecha:** 5 de Junio de 2026  
**Estado:** DRAFT  
**Audiencia:** Todos los productos SaaS que se conectan a Campamento Base

---

## 📋 Resumen

Este documento define el **contrato API** que **Campamento Base** (Control Plane) expone a todos los productos SaaS independientes (SocialFlow, Mentoría, Clinic, etc.).

**Principios:**
- ✅ **API-First:** Contract define comportamiento, no implementación
- ✅ **Versioned:** Cambios breaking requieren nueva major version
- ✅ **Backward Compatible:** Productos no deben romper con updates menores
- ✅ **Typed:** TypeScript contracts estrictos
- ✅ **Documented:** OpenAPI 3.0 specs

---

## 🏗️ Arquitectura de Contracts

```
┌─────────────────────────────────────────────────┐
│         Campamento Base (Control Plane)         │
│                                                 │
│  ┌──────────────────────────────────────────┐  │
│  │      Public API Contract v1.0            │  │
│  │                                          │  │
│  │  • /api/v1/auth/*                        │  │
│  │  • /api/v1/billing/*                     │  │
│  │  • /api/v1/registry/*                    │  │
│  │  • /api/v1/observability/*               │  │
│  │  • /api/v1/provisioning/*                │  │
│  └──────────────────────────────────────────┘  │
└─────────────────────────────────────────────────┘
                      ▲
                      │ HTTPS / REST
                      │
        ┌─────────────┼─────────────┐
        │             │             │
┌───────▼───────┐ ┌──▼──────────┐ ┌▼─────────────┐
│  SocialFlow   │ │  Mentoría   │ │   Clinic     │
│               │ │             │ │              │
│ • Client SDK  │ │ • Client SDK│ │ • Client SDK │
│ • Auth Token  │ │ • Auth Token│ │ • Auth Token │
└───────────────┘ └─────────────┘ └──────────────┘
```

---

## 🔐 1. AUTH & IDENTITY

### 1.1 Session Validation

**Endpoint:** `POST /api/v1/auth/validate-session`

**Request:**
```typescript
{
  token: string;        // JWT or session token
  requestContext?: {
    ip?: string;
    userAgent?: string;
  };
}
```

**Response:**
```typescript
{
  valid: boolean;
  session?: {
    userId: string;
    tenantId: string;
    email: string;
    roles: string[];
    permissions: string[];
    expiresAt: string; // ISO 8601
  };
  error?: {
    code: string;
    message: string;
  };
}
```

**Error Codes:**
- `TOKEN_EXPIRED` — Session expired
- `TOKEN_INVALID` — Malformed or invalid token
- `USER_DISABLED` — User account disabled
- `TENANT_SUSPENDED` — Tenant suspended

---

### 1.2 Tenant Context Resolution

**Endpoint:** `GET /api/v1/auth/tenant-context/{userId}`

**Response:**
```typescript
{
  tenantId: string;
  tenantName: string;
  tenantStatus: "active" | "suspended" | "trial" | "churned";
  subscription: {
    plan: string;
    status: string;
    currentPeriodEnd: string;
  };
  permissions: {
    [resourceType: string]: string[]; // e.g., "socialflow.posts": ["read", "write"]
  };
}
```

---

### 1.3 Permission Check

**Endpoint:** `POST /api/v1/auth/check-permission`

**Request:**
```typescript
{
  userId: string;
  tenantId: string;
  resource: string;     // e.g., "socialflow.posts"
  action: string;       // e.g., "write"
}
```

**Response:**
```typescript
{
  allowed: boolean;
  reason?: string;      // If denied, explanation
}
```

**Casos de Uso:**
```typescript
// En SocialFlow worker
const canPublish = await campamentoBase.auth.checkPermission({
  userId: session.userId,
  tenantId: session.tenantId,
  resource: "socialflow.posts",
  action: "publish"
});

if (!canPublish.allowed) {
  return Response.json({ error: canPublish.reason }, { status: 403 });
}
```

---

## 💳 2. BILLING & SUBSCRIPTIONS

### 2.1 Get Subscription

**Endpoint:** `GET /api/v1/billing/subscriptions/{tenantId}`

**Response:**
```typescript
{
  subscriptionId: string;
  tenantId: string;
  plan: string;               // "free" | "starter" | "professional" | "enterprise"
  status: string;             // "active" | "trialing" | "past_due" | "canceled"
  currentPeriodStart: string; // ISO 8601
  currentPeriodEnd: string;   // ISO 8601
  cancelAtPeriodEnd: boolean;
  trialEnd?: string;
  products: {
    [productId: string]: {    // e.g., "socialflow", "mentoria"
      enabled: boolean;
      limits: {
        [limitKey: string]: number; // e.g., "max_posts_per_month": 100
      };
    };
  };
}
```

**Ejemplo:**
```json
{
  "subscriptionId": "sub_1234",
  "tenantId": "demo-tenant",
  "plan": "professional",
  "status": "active",
  "currentPeriodStart": "2026-06-01T00:00:00Z",
  "currentPeriodEnd": "2026-07-01T00:00:00Z",
  "products": {
    "socialflow": {
      "enabled": true,
      "limits": {
        "max_posts_per_month": 100,
        "max_accounts": 5
      }
    },
    "mentoria": {
      "enabled": false,
      "limits": {}
    }
  }
}
```

---

### 2.2 Record Usage

**Endpoint:** `POST /api/v1/billing/usage`

**Request:**
```typescript
{
  tenantId: string;
  productId: string;    // e.g., "socialflow"
  metricName: string;   // e.g., "posts_published"
  value: number;
  timestamp?: string;   // ISO 8601, defaults to now
  metadata?: {
    [key: string]: any;
  };
}
```

**Response:**
```typescript
{
  recorded: boolean;
  currentUsage: number; // Total for current period
  limit?: number;       // Limit for this metric
  percentUsed?: number; // 0-100
  warning?: string;     // If approaching limit
}
```

**Ejemplo:**
```typescript
// Cuando SocialFlow publica un post
await campamentoBase.billing.recordUsage({
  tenantId: session.tenantId,
  productId: "socialflow",
  metricName: "posts_published",
  value: 1,
  metadata: {
    postId: "post_123",
    channel: "linkedin"
  }
});
```

---

### 2.3 Create Checkout Session

**Endpoint:** `POST /api/v1/billing/checkout-sessions`

**Request:**
```typescript
{
  tenantId: string;
  priceId: string;          // Stripe Price ID
  successUrl: string;
  cancelUrl: string;
  trialDays?: number;
}
```

**Response:**
```typescript
{
  sessionId: string;
  checkoutUrl: string;      // Redirect user here
  expiresAt: string;
}
```

---

## 📦 3. REGISTRY & DISCOVERY

### 3.1 Get SaaS Metadata

**Endpoint:** `GET /api/v1/registry/saas/{saasId}`

**Response:**
```typescript
{
  saasId: string;
  displayName: string;
  slug: string;
  status: "ACTIVE" | "DISABLED" | "DEGRADED" | "ARCHIVED";
  version: string;
  endpoints: {
    public: string;         // Public URL
    api: string;            // API base URL
    health: string;         // Health check endpoint
  };
  capabilities: string[];   // e.g., ["publishing", "analytics"]
  dependencies: {
    [serviceId: string]: string; // e.g., "campamento-base": "v1.0"
  };
  metadata: {
    [key: string]: any;
  };
}
```

---

### 3.2 Report Health

**Endpoint:** `POST /api/v1/registry/health`

**Request:**
```typescript
{
  saasId: string;
  status: "healthy" | "degraded" | "down";
  checks: {
    [checkName: string]: {
      status: "pass" | "fail" | "warn";
      message?: string;
      latencyMs?: number;
    };
  };
  timestamp: string;
}
```

**Ejemplo:**
```typescript
// Cada producto reporta health cada 60s
await campamentoBase.registry.reportHealth({
  saasId: "socialflow",
  status: "healthy",
  checks: {
    "database": {
      status: "pass",
      latencyMs: 23
    },
    "linkedin-api": {
      status: "warn",
      message: "Rate limit at 80%",
      latencyMs: 450
    }
  },
  timestamp: new Date().toISOString()
});
```

---

## 📊 4. OBSERVABILITY

### 4.1 Log Event

**Endpoint:** `POST /api/v1/observability/events`

**Request:**
```typescript
{
  productId: string;
  tenantId: string;
  eventType: string;        // e.g., "post.published", "session.started"
  severity: "debug" | "info" | "warn" | "error" | "critical";
  message: string;
  metadata?: {
    [key: string]: any;
  };
  timestamp?: string;
  correlationId?: string;   // For tracing
}
```

**Response:**
```typescript
{
  eventId: string;
  indexed: boolean;
}
```

---

### 4.2 Track Metric

**Endpoint:** `POST /api/v1/observability/metrics`

**Request:**
```typescript
{
  productId: string;
  tenantId?: string;        // Optional, for global metrics
  metricName: string;       // e.g., "posts.published.count"
  value: number;
  unit?: string;            // e.g., "count", "ms", "bytes"
  dimensions?: {
    [key: string]: string;  // e.g., { "channel": "linkedin", "status": "success" }
  };
  timestamp?: string;
}
```

---

## 🏭 5. PROVISIONING

### 5.1 Initialize Product for Tenant

**Endpoint:** `POST /api/v1/provisioning/initialize`

**Request:**
```typescript
{
  tenantId: string;
  productId: string;
  config: {
    plan: string;
    features: string[];
    customConfig?: {
      [key: string]: any;
    };
  };
}
```

**Response:**
```typescript
{
  jobId: string;
  status: "CREATED" | "RUNNING" | "COMPLETED" | "FAILED";
  progress: number;         // 0-100
  steps: {
    [stepName: string]: {
      status: string;
      completedAt?: string;
    };
  };
}
```

---

### 5.2 Teardown Product for Tenant

**Endpoint:** `POST /api/v1/provisioning/teardown`

**Request:**
```typescript
{
  tenantId: string;
  productId: string;
  deleteData: boolean;      // Hard delete vs soft delete
}
```

**Response:**
```typescript
{
  jobId: string;
  status: string;
  estimatedCompletionTime?: string;
}
```

---

## 🛡️ AUTENTICACIÓN DE REQUESTS

Todos los requests a Campamento Base deben incluir:

### Option A: Service Token (Server-to-Server)
```http
Authorization: Bearer service_token_abc123xyz
X-Product-ID: socialflow
X-Tenant-ID: demo-tenant
```

### Option B: User Session Token
```http
Authorization: Bearer user_session_token_xyz789
X-Product-ID: socialflow
```

Campamento Base valida:
1. Token signature
2. Token expiration
3. Product ID matches token
4. Tenant ID matches user/tenant in token

---

## 📝 RATE LIMITS

### Per Product
- **Auth endpoints:** 1000 req/min
- **Billing endpoints:** 500 req/min
- **Observability endpoints:** 10000 req/min (high throughput)
- **Registry endpoints:** 100 req/min

### Headers
```http
X-RateLimit-Limit: 1000
X-RateLimit-Remaining: 847
X-RateLimit-Reset: 1717592400
```

Si excedes:
```http
HTTP/1.1 429 Too Many Requests
Retry-After: 42
```

---

## 🧪 ENVIRONMENTS

### Production
- **Base URL:** `https://base.drako.systems`
- **Latency SLA:** p95 < 200ms
- **Availability SLA:** 99.9%

### Staging
- **Base URL:** `https://base-staging.drako.systems`
- **Latency SLA:** No SLA
- **Availability SLA:** Best effort

### Development
- **Base URL:** `http://localhost:3000` (local)
- **Mock mode:** Set `CAMPAMENTO_BASE_MOCK=true`

---

## 🔄 VERSIONING STRATEGY

### Semantic Versioning
- **Major (v1 → v2):** Breaking changes
- **Minor (v1.0 → v1.1):** New endpoints, backward compatible
- **Patch (v1.0.0 → v1.0.1):** Bug fixes

### Deprecation Policy
1. **Announce:** 90 days before deprecation
2. **Mark deprecated:** Add `Deprecated: true` header
3. **Sunset:** Remove after 180 days

### Example
```http
Deprecated: true
Sunset: Fri, 01 Dec 2026 00:00:00 GMT
Link: </api/v2/auth/validate-session>; rel="successor-version"
```

---

## 📦 CLIENT SDK (TypeScript)

### Installation
```bash
npm install @drako/campamento-base-client
```

### Usage
```typescript
import { CampamentoBaseClient } from '@drako/campamento-base-client';

const client = new CampamentoBaseClient({
  baseUrl: 'https://base.drako.systems',
  productId: 'socialflow',
  serviceToken: process.env.CAMPAMENTO_SERVICE_TOKEN
});

// Auth
const session = await client.auth.validateSession({
  token: userToken
});

// Billing
const subscription = await client.billing.getSubscription(tenantId);

// Observability
await client.observability.logEvent({
  productId: 'socialflow',
  tenantId: session.tenantId,
  eventType: 'post.published',
  severity: 'info',
  message: 'Post published successfully',
  metadata: { postId: 'post_123' }
});
```

---

## ⚠️ ERROR HANDLING

### Standard Error Response
```typescript
{
  error: {
    code: string;         // Machine-readable, e.g., "TENANT_NOT_FOUND"
    message: string;      // Human-readable
    details?: {
      [key: string]: any;
    };
    requestId: string;    // For support
  };
}
```

### Common Error Codes

| Code | HTTP Status | Meaning |
|------|-------------|---------|
| `INVALID_REQUEST` | 400 | Malformed request body |
| `UNAUTHORIZED` | 401 | Missing or invalid auth |
| `FORBIDDEN` | 403 | Insufficient permissions |
| `NOT_FOUND` | 404 | Resource not found |
| `CONFLICT` | 409 | Resource already exists |
| `RATE_LIMITED` | 429 | Too many requests |
| `INTERNAL_ERROR` | 500 | Server error |
| `SERVICE_UNAVAILABLE` | 503 | Temporarily unavailable |

---

## 🧪 TESTING

### Mock Client for Tests
```typescript
import { MockCampamentoBaseClient } from '@drako/campamento-base-client/mock';

const mockClient = new MockCampamentoBaseClient();

// Setup mocks
mockClient.auth.validateSession.mockResolvedValue({
  valid: true,
  session: {
    userId: 'user_123',
    tenantId: 'tenant_abc',
    email: 'test@example.com',
    roles: ['admin'],
    permissions: ['*'],
    expiresAt: '2026-12-31T23:59:59Z'
  }
});

// Use in tests
const result = await service.doSomething(mockClient);
expect(result.success).toBe(true);
```

---

## 📖 OPENAPI SPEC

Full OpenAPI 3.0 specification:
- **Location:** `docs/contracts/openapi-campamento-base-v1.0.yaml`
- **Interactive Docs:** `https://base.drako.systems/api-docs`

---

## ✅ IMPLEMENTATION CHECKLIST

Para implementar un nuevo producto SaaS:

- [ ] Install `@drako/campamento-base-client`
- [ ] Configure service token en env vars
- [ ] Implement auth validation via `/api/v1/auth/validate-session`
- [ ] Implement subscription checks via `/api/v1/billing/subscriptions`
- [ ] Report health every 60s via `/api/v1/registry/health`
- [ ] Log events via `/api/v1/observability/events`
- [ ] Track metrics via `/api/v1/observability/metrics`
- [ ] Handle rate limits (429) with retry + backoff
- [ ] Handle errors gracefully with fallback
- [ ] Write integration tests with mock client

---

**Versión:** 1.0.0  
**Estado:** DRAFT — Pending review  
**Owner:** Campamento Base Team  
**Last Updated:** 2026-06-05
