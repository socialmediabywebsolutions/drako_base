# Campamento Base Operational Audit

## Executive Summary

This audit assesses Campamento Base (Holding layer) readiness to operate the Drako multi-SaaS ecosystem. Analysis covers SaaS provisioning, factory orchestration, billing integration, multi-SaaS management, and runtime infrastructure.

**Overall Assessment**: **PARTIALLY READY** - Core provisioning and factory systems are production-ready, but critical gaps exist in operational oversight, billing integration, and domain routing.

---

## 1. SaaS Provisioning System

### 1.1 Core Tables Analysis

**✅ PRODUCTION READY**

The five canonical provisioning tables are properly implemented:

```sql
-- Core Registry (Migration 0116)
saas_instances (id, tenant_id, slug, name, status, plan_tier, trial_domain, custom_domain, domain_status)

-- Legacy SaaS (Migration 0001)
saas (id, tenant_id, name, slug, status, domain, subdomain, public_domain, public_subdomain, domain_status)

-- Domain Management (Migration 0114)
saas_domains (id, tenant_id, saas_id, domain, is_primary, status, verification_status, verification_reason)

-- Provisioning Orchestration (Migration 0045)
provisioning_jobs (job_id, type, entity_id, current_state, payload_json, tenant_id, execution_lock, lock_owner)

-- Runtime Contract (Migration 0111)
campamento_provisioning (id, tenant_id, saas_id, mode, status, plan, last_error)
```

**Strengths**:
- Multi-tenant isolation enforced via `tenant_id` in all tables
- Atomic state transitions with fencing tokens
- Comprehensive audit trails via `step_history_json`
- Proper indexing for performance

**Architectural Risks**:
- **Dual Registry Pattern**: Both `saas` and `saas_instances` exist, creating potential consistency issues
- **Legacy Dependencies**: Some components still reference `saas` table instead of canonical `saas_instances`

### 1.2 Data Consistency

**⚠️ UNSTABLE AREAS**

```sql
-- Migration 0116 attempts unification but incomplete
INSERT OR IGNORE INTO saas_instances (id, tenant_id, slug, name, status, created_at, updated_at, plan_tier)
SELECT id, tenant_id, slug, display_name, status, created_at, updated_at, 
       CASE WHEN slug IN ('drako', 'mentoria') THEN 'enterprise' ELSE 'starter' END
FROM saas_projects;
```

**Missing Components**:
- Automated sync between `saas` and `saas_instances` tables
- Consistency validation jobs
- Data migration completion verification

---

## 2. Factory Orchestration

### 2.1 SaaS Registration

**✅ PRODUCTION READY**

Factory registration follows canonical flow:

```typescript
// src/lib/campamento-base/saas-factory-orchestrator.ts
export async function createSaasFromBlueprint(params: {
  env: DracoEnv;
  ownerTenantId: string;
  blueprint: SaasBlueprintDraft;
}): Promise<{ saasId: string; status: SaasProvisioningStatus; error?: string }>
```

**State Machine Implementation**:
```typescript
export type ProvisioningJobState =
  | 'CREATED'
  | 'RUNNING' 
  | 'SAAS_REGISTERED'
  | 'STRIPE_PRODUCT_CREATED'
  | 'RUNTIME_DEPLOYED'
  | 'BOOTSTRAP_READY'
  | 'CUSTOM_DOMAIN_READY'
  | 'SUCCESS'
  | 'DEGRADED'
  | 'FAILED';
```

**Strengths**:
- Atomic state transitions with fencing tokens
- Comprehensive step-by-step provisioning
- Idempotent operations with retry logic
- Proper error handling and rollback support

### 2.2 Runtime Deployment

**✅ PRODUCTION READY**

Canonical runtime deployment pattern:

```typescript
const CANONICAL_RUNTIME_NAME = "shared_open_next_runtime";

type RuntimeDeploymentResult = {
  mode: "shared_runtime";
  runtimeName: string;
  trialDomain: string;
  customDomain: string | null;
  status: "provisioning" | "active" | "degraded";
  activationReady: boolean;
  lastKnownDomainStatus: string;
};
```

**Bootstrap Configuration**:
```typescript
const TRIAL_BOOTSTRAP_BASELINE: SaasFeatureKey[] = [
  "BLUEPRINT",
  "APPEARANCE_BRANDING", 
  "OWNER_CONTROL",
];
```

### 2.3 Failure Recovery

**⚠️ PARTIALLY READY**

**Recovery Mechanisms**:
- Job reaper for stale locks (15-minute timeout)
- Degraded state handling
- Manual intervention support via governance actions

**Missing Recovery Components**:
- Automated retry policies for transient failures
- Circuit breaker patterns for external dependencies
- Comprehensive incident escalation workflows

---

## 3. Billing Integration

### 3.1 Stripe Product Creation

**⚠️ PARTIALLY READY**

Stripe factory integration implemented:

```typescript
// src/lib/campamento-base/provisioning/stripe-factory.ts
export async function ensureStripeProductForSaas(params: {
  env: DracoEnv;
  blueprint: SaasBlueprintDraft;
  pricingRecommendation?: SaasPricingRecommendation | null;
  saasId: string;
  tenantId: string;
  correlationId: string;
}): Promise<StripeProvisioningResult>
```

**Configuration Controls**:
```typescript
function resolveProvisioningEnabled(envOverride?: DracoEnv | null): boolean;
function resolveProvisioningMode(envOverride?: DracoEnv | null): "dry_run" | "live";
function resolveStripeGateRequired(envOverride?: DracoEnv | null): boolean;
function resolveStripeOverride(envOverride?: DracoEnv | null): boolean;
```

**Strengths**:
- Environment-based provisioning controls
- Dry-run mode for testing
- Comprehensive error handling

**Critical Gaps**:
- **Missing Webhook Handlers**: No evidence of Stripe webhook processing for subscription events
- **No Billing Lifecycle Integration**: Stripe events not connected to SaaS lifecycle transitions
- **Missing Readiness Signals**: Billing status not propagated to readiness calculations

### 3.2 Tenant Billing Lifecycle

**❌ NOT READY**

Expected billing lifecycle not implemented:

```typescript
// Expected but not found:
export async function handleStripeInvoicePaymentFailed(invoiceId: string);
export async function handleStripeSubscriptionUpdated(subscriptionId: string);
export async function handleStripeCustomerSubscriptionDeleted(customerId: string);
```

**Missing Components**:
- Stripe webhook endpoints
- Subscription status synchronization
- Automatic lifecycle transitions based on billing events
- Dunning management for failed payments

### 3.3 Billing → Readiness Signals

**❌ NOT READY**

No integration between billing status and SaaS readiness:

```typescript
// SocialFlow readiness calculation (manual workaround)
const effectiveSummary = summary.readiness.stage === "PILOT_READY" && 
  billingReady && 
  liveConnectedAccounts > 0 && 
  livePublishedPosts > 0
    ? { ...summary, readiness: { stage: "FIRST_PAYING_USER_READY" } }
    : summary;
```

**Critical Missing Signals**:
- Billing status → readiness stage transitions
- Payment method validation
- Subscription health monitoring
- Automated readiness degradation on billing issues

---

## 4. Multi-SaaS Management

### 4.1 SaaS Listing and Control

**✅ PRODUCTION READY**

Canonical SaaS registry implementation:

```typescript
// src/lib/saas/canonical-registry.ts
export async function listCanonicalSaasForTenant(tenantId: string, limit = 6): Promise<CanonicalSaasSummary[]>
export async function getCanonicalFactoryOverview(tenantId: string): Promise<CanonicalFactoryOverview>
```

**Factory Status Monitoring**:
```typescript
// src/lib/factory/status.ts
export type FactoryStatus = {
  activeSaas: number;
  jobs: FactoryJobStatus;
  domains: FactoryDomainStatus;
  usage: { saasCount: number; activeJobCount: number; domainCount: number; };
  slo: { degraded: boolean; failing: boolean; };
  quota?: FactoryQuota;
  limits?: FactoryLimits;
};
```

### 4.2 Instance Lifecycle

**✅ PRODUCTION READY**

Lifecycle management implemented:

```typescript
// src/lib/os/lifecycle.ts
export type LifecycleStatus = 'active' | 'past_due' | 'paused' | 'archived' | 'provisioning';

export async function transitionToPastDue(saasId: string, reason: string, stripeEventId: string);
export async function autoPauseIfPastDueExceeded(saasId: string, now: Date = new Date());
export async function resumeToActive(saasId: string, stripeEventId: string);
export async function archiveSaaS(saasId: string, reason: string);
```

**Economic Events Tracking**:
```typescript
export async function writeEconomicEvent(payload: EconomicEventPayload) {
  // Records lifecycle transitions with audit trail
}
```

### 4.3 Domain Routing

**⚠️ PARTIALLY READY**

Domain management infrastructure exists:

```sql
-- Migration 0114
CREATE TABLE IF NOT EXISTS saas_domains (
  id TEXT PRIMARY KEY,
  tenant_id TEXT NOT NULL,
  saas_id TEXT NOT NULL,
  domain TEXT NOT NULL,
  is_primary INTEGER NOT NULL DEFAULT 0,
  status TEXT NOT NULL DEFAULT 'pending',
  verification_status TEXT,
  verification_reason TEXT,
  retry_count INTEGER NOT NULL DEFAULT 0,
  last_checked_at TEXT,
  created_at TEXT DEFAULT (strftime('%Y-%m-%dT%H:%M:%fZ','now')),
  updated_at TEXT DEFAULT (strftime('%Y-%m-%dT%H:%M:%fZ','now')),
  verification_token TEXT,
  last_error TEXT
);
```

**Missing Routing Components**:
- Dynamic DNS configuration for custom domains
- SSL certificate automation
- Domain health monitoring
- Routing failover mechanisms

---

## 5. Runtime Infrastructure

### 5.1 Cloudflare Workers

**✅ PRODUCTION READY**

Workers configuration comprehensive:

```toml
# wrangler.workers.toml
name = "drako-base-3"
main = ".open-next/worker.js"
compatibility_date = "2024-11-01"
compatibility_flags = ["nodejs_compat"]

# AI Binding
[ai]
binding = "AI"

# Multiple D1 Databases
[[d1_databases]]
binding = "DRACO_DB"
database_name = "drako_db_prod"
database_id = "5607a76a-97c7-45a9-a948-e545ba27eae7"
```

**Queue Infrastructure**:
```toml
# Provisioning Queues
[[queues.producers]]
queue = "drako-saas-factory-queue"
binding = "SAAS_FACTORY_QUEUE"

[[queues.producers]]
queue = "drako-provisioning-queue"
binding = "PROVISIONING_QUEUE"
```

### 5.2 OpenNext Shared Runtime

**✅ PRODUCTION READY**

OpenNext configuration optimized for Workers:

```typescript
// open-next.config.ts
const config = {
  default: {
    override: {
      wrapper: "cloudflare-node",
      converter: "edge",
      proxyExternalRequest: "fetch",
      incrementalCache: "dummy",
      tagCache: "dummy",
      queue: "direct",
    },
  },
  edgeExternals: ["node:crypto"],
  middleware: {
    external: true,
    override: {
      wrapper: "cloudflare-edge",
      converter: "edge",
      proxyExternalRequest: "fetch",
      incrementalCache: "dummy",
      tagCache: "dummy",
      queue: "direct",
    },
  },
};
```

**Shared Runtime Pattern**:
- Single runtime serves all SaaS instances
- Subdomain-based routing for trials
- Custom domain support for production
- Edge-optimized middleware

### 5.3 Deployment Pipeline

**✅ PRODUCTION READY**

CI/CD integration via GitHub Actions:

```yaml
# .github/workflows/drako-factory-deploy.yml
# Canonical deployment path (enforced)
- Blocked legacy root worker deploys
- Production deploys only via GitHub Actions
- Required secrets: CLOUDFLARE_API_TOKEN, CLOUDFLARE_ACCOUNT_ID
```

**Safety Mechanisms**:
- Pre-deploy validation checks
- Staged rollouts
- Automated rollback capabilities

---

## 6. Governance and Oversight

### 6.1 CEO Override Actions

**✅ PRODUCTION READY**

Comprehensive governance interface:

```typescript
// src/app/site/panel/hq/actions.ts
export async function executeGovernanceAction({ 
  tenantId, slug, action, reason 
}: GovernanceAction) {
  // Actions: FREEZE | BONUS | UPGRADE | KILL | FORCE_ACTIVE | ARCHIVE
}
```

**Intervention Tracking**:
- Economic event logging
- Intervention audit trail
- Reason documentation

### 6.2 Campamento Base Structure

**✅ PRODUCTION READY**

Full organizational structure implemented:

```typescript
// src/lib/campamento-base.ts
// 13 Departments with 40+ specialized agents
const departments = [
  { id: "core_dir", slug: "direccion", nombre: "Dirección y Estrategia" },
  { id: "core_mkt", slug: "marketing", nombre: "Marketing y Redes Sociales" },
  // ... 11 more departments
];
```

---

## 7. Critical Risk Assessment

### 7.1 High-Risk Areas

**❌ CRITICAL: Billing Integration Gap**
- No Stripe webhook handlers
- Billing events not connected to lifecycle
- Manual readiness calculations required
- **Impact**: Revenue leakage, incorrect lifecycle states

**⚠️ HIGH: Data Consistency Risk**
- Dual registry pattern (`saas` vs `saas_instances`)
- No automated sync between tables
- **Impact**: Data divergence, reporting errors

**⚠️ HIGH: Domain Routing Incomplete**
- Missing dynamic DNS configuration
- No SSL automation
- **Impact**: Custom domain failures, poor UX

### 7.2 Medium-Risk Areas

**⚠️ MEDIUM: Limited Recovery Automation**
- Manual intervention required for many failure scenarios
- No circuit breaker patterns
- **Impact**: Longer recovery times, operator burden

**⚠️ MEDIUM: Missing Operational Dashboards**
- Limited real-time monitoring
- No proactive alerting
- **Impact**: Slower incident response

### 7.3 Low-Risk Areas

**✅ LOW: Factory Orchestration**
- Robust state machine implementation
- Comprehensive error handling
- Good testing coverage

---

## 8. Production Readiness Assessment

### 8.1 Ready Components ✅

1. **SaaS Provisioning System**
   - Core tables properly designed
   - Multi-tenant isolation enforced
   - Atomic state transitions

2. **Factory Orchestration**
   - Complete state machine
   - Runtime deployment automation
   - Bootstrap configuration

3. **Runtime Infrastructure**
   - Workers configuration complete
   - OpenNext integration optimized
   - CI/CD pipeline secure

4. **Multi-SaaS Management**
   - Canonical registry implementation
   - Lifecycle management
   - Governance controls

### 8.2 Missing Components ❌

1. **Billing Integration**
   - Stripe webhook handlers
   - Subscription lifecycle automation
   - Billing → readiness signals

2. **Domain Routing**
   - Dynamic DNS configuration
   - SSL certificate automation
   - Health monitoring

3. **Operational Monitoring**
   - Real-time dashboards
   - Proactive alerting
   - Automated recovery

### 8.3 Unstable Areas ⚠️

1. **Data Consistency**
   - Dual registry synchronization
   - Migration completion verification
   - Consistency validation jobs

2. **Failure Recovery**
   - Automated retry policies
   - Circuit breaker patterns
   - Incident escalation workflows

---

## 9. Recommendations

### 9.1 Immediate Actions (Critical)

1. **Implement Stripe Webhook Handlers**
   ```typescript
   // POST /api/stripe/webhooks
   export async function handleStripeWebhook(req: Request) {
     // Handle invoice.payment_failed, customer.subscription.updated, etc.
   }
   ```

2. **Connect Billing to Lifecycle**
   ```typescript
   export async function handleBillingEvent(event: StripeEvent) {
     // Update saas_instances.lifecycle_status based on billing
   }
   ```

3. **Complete Data Migration**
   ```sql
   -- Sync saas ↔ saas_instances
   CREATE TRIGGER sync_saas_instances AFTER INSERT ON saas
   ```

### 9.2 Short-term Improvements (High Priority)

1. **Domain Routing Automation**
   - Implement Cloudflare DNS API integration
   - Add SSL certificate automation
   - Create domain health monitoring

2. **Operational Dashboards**
   - Real-time factory status monitoring
   - Billing health dashboard
   - Domain provisioning status

3. **Enhanced Recovery**
   - Automated retry policies
   - Circuit breaker implementation
   - Incident escalation workflows

### 9.3 Long-term Enhancements (Medium Priority)

1. **Advanced Monitoring**
   - Distributed tracing
   - Performance metrics
   - Predictive alerting

2. **Self-Healing**
   - Automated problem detection
   - Self-recovery mechanisms
   - Reduced manual intervention

---

## 10. Conclusion

Campo Base demonstrates **strong foundational architecture** with robust provisioning, factory orchestration, and runtime infrastructure. However, **critical billing integration gaps** and **data consistency issues** prevent full production readiness.

**Timeline to Production Ready**:
- **Critical fixes**: 2-3 weeks
- **High priority items**: 4-6 weeks  
- **Full operational readiness**: 8-10 weeks

The foundation is solid, but focused work is needed on billing integration and operational maturity to safely operate the multi-SaaS ecosystem at scale.
