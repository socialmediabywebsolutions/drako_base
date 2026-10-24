# Drako SaaS Blueprint

## Overview

This document extracts the reusable SaaS generation blueprint from the current Drako repository, providing a canonical pattern for any new vertical SaaS product within the multi-SaaS ecosystem.

## 1. SaaS Vertical Definition

### 1.1 Canonical SaaS Data Model

Every SaaS product follows the canonical provisioning model with these core tables:

```sql
-- Core SaaS definition
saas (id, tenant_id, name, slug, status, domain, public_domain, domain_status)

-- Runtime instance registry  
saas_instances (id, tenant_id, name, slug, status, plan_tier, trial_domain, custom_domain, domain_status)

-- Domain management
saas_domains (id, tenant_id, saas_id, domain, is_primary, status, verification_status)

-- Provisioning orchestration
provisioning_jobs (job_id, type, entity_id, current_state, payload_json, tenant_id)

-- Runtime contract state
campamento_provisioning (id, tenant_id, saas_id, mode, status, plan, last_error)
```

### 1.2 Vertical Classification

```typescript
export type SaasVerticalId = "SALON" | "CLINIC" | "PET_GROOMING" | "LAUNDRY" | "EDUCATION" | "CRYPTO" | "OTHER";
```

### 1.3 Blueprint Structure

```typescript
export type SaasBlueprintDraft = {
  ownerTenantId: string;
  saasName: string;
  proposedSlug: string;
  proposedSubdomain: string;
  verticalId: SaasVerticalId;
  summary: string;
  targetAudience: string;
  mainProblem: string;
  mainGoal: string;
  packsByDepartment: {
    marketing?: DepartmentPackTier;
    accounting?: AccountingPackTier;
    support?: DepartmentPackTier;
    emailIntake?: AccountingPackTier;
    ops?: DepartmentPackTier;
    tax?: AccountingPackTier;
  };
  initialPricing: {
    currentMonthlyPrice: number;
    estimatedVendorCostMonthly?: number | null;
    recommendedMinPriceMonthly?: number | null;
    recommendedTargetPriceMonthly?: number | null;
    recommendedStretchPriceMonthly?: number | null;
  };
  aiProfile: {
    tier: AiTier; // "COST_SAVER" | "BALANCED" | "PREMIUM"
    notes?: string;
  };
  provisioning?: {
    domains: {
      primarySubdomain: string;
      primaryDomainType: "SUBDOMAIN_ONLY" | "CUSTOM_DOMAIN_ALLOWED";
      customDomainRequested?: string | null;
    };
    stripe: {
      billingInterval: "MONTHLY" | "YEARLY";
      taxProfile: "ES_AUTONOMO" | "ES_SL" | "OTHER";
      currency: string;
    };
    ai: {
      tier: AiTier;
      preferredProviders?: string[];
    };
  };
};
```

## 2. Provisioning Integration with Factory

### 2.1 Factory Orchestration Contract

The SaaS Factory follows a strict state machine with atomic transitions:

```typescript
export type ProvisioningJobState =
  | 'CREATED'
  | 'RUNNING' 
  | 'ACTIVE'
  | 'SUCCESS'
  | 'DEGRADED'
  | 'FAILED'
  | 'RETRYABLE_FAILED'
  | 'ROLLING_BACK'
  // SaaS Specific States
  | 'SAAS_REGISTERED'
  | 'STRIPE_PRODUCT_CREATED'
  | 'RUNTIME_DEPLOYED'
  | 'PROVISION_WORKER'
  | 'CREATE_DOMAIN_BINDING'
  | 'VERIFY_DOMAIN'
  | 'BOOTSTRAP_READY'
  | 'CUSTOM_DOMAIN_READY';
```

### 2.2 Canonical Provisioning Flow

1. **SAAS_REGISTERED**: Database registration completed
2. **STRIPE_PRODUCT_CREATED**: Stripe product and pricing created
3. **RUNTIME_DEPLOYED**: Runtime contract deployed (shared OpenNext runtime)
4. **BOOTSTRAP_READY**: Default configuration and features enabled
5. **CUSTOM_DOMAIN_READY**: Custom domain verified (if requested)
6. **SUCCESS**: Full provisioning completed

### 2.3 Runtime Deployment Pattern

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

### 2.4 Bootstrap Configuration

```typescript
const TRIAL_BOOTSTRAP_BASELINE: SaasFeatureKey[] = [
  "BLUEPRINT",
  "APPEARANCE_BRANDING", 
  "OWNER_CONTROL",
];

const DEFAULT_BOOTSTRAP_THEME = {
  primaryColor: "#1f2937",
  secondaryColor: "#475569",
  accentColor: "#f59e0b",
  backgroundColor: "#ffffff",
  surfaceColor: "#f8fafc",
  textColor: "#111827",
  dangerColor: "#dc2626",
  successColor: "#16a34a",
  layoutDensity: "NORMAL",
  enableDarkMode: false,
};
```

## 3. Readiness Lifecycle Stages

### 3.1 Product Readiness Model

```typescript
export type ProductReadinessStage = 
  | "PROTOTYPE"
  | "PILOT_READY" 
  | "FIRST_PAYING_USER_READY";
```

### 3.2 SocialFlow Implementation Example

SocialFlow demonstrates the readiness lifecycle:

```typescript
type SocialProductReadiness = {
  stage: "GUIDED_SETUP" | "EARLY_USER_READY" | "PILOT_READY" | "FIRST_PAYING_USER_READY";
  label: string;
  readyNow: string[];
  simulatedAreas: string[];
  pilotNotes: string[];
};
```

### 3.3 Readiness Stage Criteria

**PROTOTYPE**:
- Core functionality simulated
- Demo data active
- No live integrations

**PILOT_READY**:
- One live integration working
- Core features functional
- Demo fallbacks for non-critical paths

**FIRST_PAYING_USER_READY**:
- Billing configured
- At least one live success demonstrated
- Operational monitoring active

### 3.4 Lifecycle State Management

```typescript
export type LifecycleStatus = 'active' | 'past_due' | 'paused' | 'archived' | 'provisioning';

// Economic events track lifecycle transitions
export async function transitionToPastDue(saasId: string, reason: string, stripeEventId: string);
export async function autoPauseIfPastDueExceeded(saasId: string, now: Date = new Date());
export async function resumeToActive(saasId: string, stripeEventId: string);
export async function archiveSaaS(saasId: string, reason: string);
```

## 4. Operator Dashboard Design

### 4.1 Factory Status Monitoring

```typescript
export type FactoryStatus = {
  activeSaas: number;
  jobs: {
    created: number;
    running: number;
    degraded: number;
    failed: number;
    succeeded: number;
  };
  domains: {
    pending: number;
    provisioning: number;
    active: number;
    failed: number;
  };
  usage: {
    saasCount: number;
    activeJobCount: number;
    domainCount: number;
  };
  slo: {
    degraded: boolean;
    failing: boolean;
  };
  quota?: FactoryQuota;
  limits?: FactoryLimits;
};
```

### 4.2 Operational Health Pattern

Dashboards must expose operational state:

- **Freshness**: Last successful sync times
- **Incident History**: Recent failures and recoveries  
- **Recovery State**: Current resolution status
- **Review Flags**: Items needing manual attention
- **Recommended Actions**: Next steps for operators

### 4.3 SocialFlow Health Model Example

```typescript
export type SocialLiveAnalyticsHealth = {
  totalEligibleLivePosts: number;
  healthyPosts: number;
  failedPosts: number;
  noLiveAnalyticsYetPosts: number;
  lastHealthyLiveSyncAt: string | null;
  healthySyncFreshnessStatus: "FRESH" | "AGING" | "NOT_AVAILABLE";
  healthySyncNeedsRefresh: boolean;
  resolvedRecently: boolean;
  resolvedRecentlyCount: number;
  lastResolvedAt: string | null;
  lastWorkspaceSyncAt: string | null;
  status: "Healthy" | "Needs attention" | "No live analytics yet";
  recommendation: string;
};
```

### 4.4 Operator Workflow Integration

```typescript
export type SocialLiveAnalyticsSyncActivity = {
  postId: string;
  postTitle: string;
  provider: SaasSocialProvider;
  lastFetchedAt: string;
  lastRefreshStatus: "success" | "error";
  lastRefreshErrorCode: string | null;
  lastRefreshErrorMessage: string | null;
  analyticsSource: "live_linkedin" | "placeholder_mvp" | "analytics_fallback";
  externalPostId: string | null;
  state: "success" | "fallback" | "error" | "resolved";
  summary: string;
  recommendation: string;
  reviewed: boolean;
  manualReviewAt: string | null;
  manualReviewNote: string | null;
  recoveryAt: string | null;
};
```

## 5. Narrow Live Integration Strategy

### 5.1 Integration Status Classification

```typescript
export type SaasSocialAccountStatus =
  | "DISCONNECTED"
  | "CONNECTED_DEMO"      // Simulated connection
  | "CONNECTED_REAL"      // Live integration
  | "PENDING_REAL"
  | "INVALID_CREDENTIALS"
  | "NEEDS_RECONNECTION";
```

### 5.2 Narrow Live Path Pattern

**Rule**: One real integration while others remain simulated.

**SocialFlow Example**:
- LinkedIn → LIVE (real publishing, real analytics)
- Other networks → DEMO (simulated data)

### 5.3 Live Integration Detection

```typescript
function isLivePublishedPost(post: SaasSocialPost) {
  if (post.status !== "PUBLISHED" && post.status !== "POSTED") return false;
  if (!post.metadata?.publication || typeof post.metadata.publication !== "object") return false;
  return (post.metadata.publication as Record<string, unknown>).mode === "live";
}

export function hasLivePostAnalytics(post: SaasSocialPost): boolean {
  return getPostAnalyticsMetadata(post)?.source === "live_linkedin";
}
```

### 5.4 Fallback Strategy

```typescript
const FALLBACK_ERROR_PATTERNS = ["no such table", "no such column"];

function shouldFallbackToDemo(error: unknown, ctx: SocialContext): boolean {
  if (ctx.mode !== "d1" || !ctx.allowDemoFallback) return false;
  const message = (error instanceof Error ? error.message : `${error ?? ""}`).toLowerCase();
  return FALLBACK_ERROR_PATTERNS.some((pattern) => message.includes(pattern));
}
```

## 6. Tenant Onboarding Flow

### 6.1 Onboarding State Tracking

```typescript
export type SocialOnboardingStep = {
  key: "connect_account" | "create_campaign" | "schedule_post" | "activate_rule" | "review_calendar_analytics";
  label: string;
  completed: boolean;
  hint: string;
};

export type SocialOnboardingState = {
  completedSteps: number;
  totalSteps: number;
  progressPercent: number;
  nextAction: string;
  steps: SocialOnboardingStep[];
};
```

### 6.2 Canonical Onboarding Steps

1. **Connect Account**: Link primary live integration
2. **Create Campaign**: Set up first marketing campaign
3. **Schedule Post**: Create and schedule content
4. **Activate Rule**: Enable automation rules
5. **Review Analytics**: Check performance metrics

### 6.3 Progressive Readiness

```typescript
// Dynamic readiness based on actual usage
const effectiveSummary = summary.readiness.stage === "PILOT_READY" && 
  billingReady && 
  liveConnectedAccounts > 0 && 
  livePublishedPosts > 0
    ? {
        ...summary,
        readiness: {
          ...summary.readiness,
          stage: "FIRST_PAYING_USER_READY" as const,
          // ... enhanced readiness details
        }
      }
    : summary;
```

## 7. Layer Boundaries

### 7.1 Four-Layer Architecture

**Holding Layer (Campo Base)**:
- Owner console, treasury, oversight
- Multi-tenant management
- Billing and subscriptions

**Factory Layer (Drako SaaS Factory)**:
- Product provisioning engine
- Runtime deployment
- Domain management
- Feature enablement

**Product Layer (Vertical SaaS)**:
- Business logic and features
- User interfaces
- Product-specific data

**Tenant Layer**:
- Individual customer data
- User sessions
- Tenant-scoped configurations

### 7.2 Boundary Enforcement Rules

**Never Mix Responsibilities**:
- Holding logic ↔ Factory provisioning
- Factory logic ↔ Product features  
- Product features ↔ Tenant data

**Data Access Patterns**:
```typescript
// Factory layer - provisioning orchestration
export async function createSaasFromBlueprint(params: {
  env: DracoEnv;
  ownerTenantId: string;
  blueprint: SaasBlueprintDraft;
});

// Product layer - business logic
export async function getSocialProductSummary(ctx: SocialContext);

// Tenant layer - user data
export async function listSaasSocialAccounts(ctx: SocialContext);
```

### 7.3 Runtime Contract Boundaries

**Shared Runtime Model**:
```typescript
type RuntimeContract = {
  mode: "shared_runtime";
  runtimeName: string;
  trialDomain: string;
  customDomain: string | null;
  status: RuntimeContractStatus;
  activationReady: boolean;
  lastKnownDomainStatus: string;
};
```

**Feature Boundaries**:
```typescript
export type SaasFeatureKey = 
  | "BLUEPRINT"
  | "APPEARANCE_BRANDING"
  | "OWNER_CONTROL"
  | "ECONOMY"
  | "HR"
  | "EMPLOYEES"
  | "STAFF_PORTAL"
  | "CLIENT_PORTAL"
  | "EMAIL_INTAKE"
  | "SOCIAL"
  | "TASKS"
  | "KNOWLEDGE"
  | "TAX_ENGINE";
```

## 8. Runtime Assumptions

### 8.1 Cloudflare Workers + OpenNext

**Runtime Stack**:
- Cloudflare Workers for serverless execution
- OpenNext for Next.js compatibility
- D1 database for persistent storage
- KV for caching and session storage

**Deployment Model**:
- Shared runtime across all SaaS instances
- Subdomain-based routing for trials
- Custom domain support for production

### 8.2 Environment Configuration

```typescript
export type DracoEnv = {
  DRACO_DB: D1Database;
  DRACO_KV: KVNamespace;
  STRIPE_SECRET_KEY: string;
  CLOUDFLARE_API_TOKEN: string;
  CLOUDFLARE_ACCOUNT_ID: string;
  DRAKO_DEMO_MODE?: string;
  PROVISIONING_FAULT_AT?: string;
};
```

### 8.3 Multi-tenant Data Isolation

All database queries must include `tenant_id`:

```sql
-- Correct: Tenant-scoped query
SELECT * FROM saas_instances WHERE tenant_id = ? AND saas_id = ?

-- Incorrect: Cross-tenant access
SELECT * FROM saas_instances WHERE saas_id = ?
```

## 9. Implementation Guidelines

### 9.1 New SaaS Product Checklist

**Pre-Development**:
- [ ] Define vertical classification
- [ ] Design blueprint structure
- [ ] Identify primary live integration
- [ ] Plan demo fallbacks

**Development**:
- [ ] Implement data models with tenant isolation
- [ ] Create provisioning integration
- [ ] Build operator dashboard
- [ ] Add readiness lifecycle tracking

**Testing**:
- [ ] Unit tests for business logic
- [ ] Integration tests for provisioning
- [ ] Demo mode verification
- [ ] Live integration testing

**Deployment**:
- [ ] Factory compatibility verification
- [ ] Runtime contract validation
- [ ] Operator workflow testing
- [ ] Production readiness audit

### 9.2 Code Organization Pattern

```
src/lib/[vertical]/
├── types.ts           # Type definitions
├── repository.ts       # Data access layer
├── context.ts         # Business logic
├── analytics.ts       # Metrics and reporting
└── live-integration.ts # External API connections

src/components/saas/[vertical]/
├── [Vertical]Dashboard.tsx    # Main product interface
├── [Vertical]WorkspaceClient.tsx # Interactive features
└── [Vertical]Onboarding.tsx    # User guidance

src/app/api/[vertical]/
└── route.ts            # API endpoints
```

### 9.3 Factory Integration Pattern

```typescript
// 1. Define blueprint types
export type [Vertical]BlueprintDraft = SaasBlueprintDraft & {
  // Vertical-specific fields
};

// 2. Implement provisioning hooks
export async function provision[Vertical]Features(params: {
  tenantId: string;
  saasId: string;
  blueprint: [Vertical]BlueprintDraft;
});

// 3. Create dashboard integration
export default async function [Vertical]Dashboard({ tenantId, saasId, instance }: DashboardProps) {
  const ctx = await resolve[Vertical]Context({ tenantId, saasId });
  // ... dashboard implementation
}
```

## 10. Conclusion

This blueprint provides the canonical pattern for generating SaaS products within the Drako ecosystem. By following these architectural patterns, operational models, and implementation guidelines, new vertical SaaS products can:

- Integrate seamlessly with the Factory provisioning engine
- Follow established readiness lifecycle stages
- Provide comprehensive operator dashboards
- Implement narrow live integration strategies
- Maintain proper layer boundaries
- Scale efficiently on the Cloudflare Workers + OpenNext runtime

The blueprint is extracted from the current production codebase and reflects the actual operational patterns that power existing Drako SaaS products like SocialFlow.
