export type AgentLayer = "CORE" | "PARTNER" | "OPERATOR";
export type AgentVertical = "GENERIC" | "SOCIAL_MARKETING" | "REAL_ESTATE" | "CLINIC" | "ECOMMERCE";
export type PackId = "starter" | "pro" | "full";

export type PermissionCloudflare = "pages" | "workers" | "d1" | "kv" | "r2" | "queues" | "cron" | "ai_gateway" | "vectorize" | "turnstile";
export type PermissionStripe = "billing" | "products" | "prices" | "metering" | "webhooks" | "customers" | "invoices";
export type PermissionOAuth = "google" | "facebook" | "linkedin" | "x" | "instagram" | "drive" | "gmail" | "calendar";
export type PermissionData = "projects" | "companies" | "entitlements" | "knowledge_bases" | "interviews" | "quotes" | "domains" | "media_assets" | "invoices" | "employees";

export interface AgentPermissions {
    cloudflare?: PermissionCloudflare[];
    stripe?: PermissionStripe[];
    oauth?: PermissionOAuth[];
    data?: {
        read?: PermissionData[];
        write?: PermissionData[];
    };
}

export interface AgentEvent {
    name: string; // Namespaced: e.g. "agents.interviews.started"
    description: string;
}

export interface AgentKpi {
    metric: "quality_score" | "time_to_value" | "cost_estimate" | "coverage" | "error_rate";
    target?: number;
    description: string;
}

export interface AgentSpec {
    // Identity
    agent_id: string; // Stable slug (plural, snake_case) e.g., 'interviews'
    label: string; // Human readable name
    layer: AgentLayer;
    verticals: AgentVertical[];
    version: string;

    // Role
    mission: string;
    responsibilities: string[];
    boundaries: string[];
    outputs_desc: string[];

    // Inputs/Outputs
    input_schema: Record<string, unknown>; // JSON-Schema like
    output_schema: Record<string, unknown>; // JSON-Schema like

    // Governance & Security
    permissions: AgentPermissions;
    emits: string[]; // Event names
    consumes: string[]; // Event names
    retry_policy: {
        attempts: number;
        backoff: "exponential" | "fixed";
    };
    idempotency_strategy: string;

    // Operational Config
    kpis: AgentKpi[];
    guardrails: {
        max_cost_usd?: number;
        max_execution_sec?: number;
        compliance_constraints?: string[];
    };
    default_enabled_by_pack: Record<PackId, boolean>;
    default_limits?: Record<string, number>;
    rate_limits?: {
        per_minute: number;
        per_day: number;
    };
    dependencies: string[]; // agent_ids
}

export interface SwarmPlan {
    vertical: AgentVertical;
    pack: PackId;
    agent_ids: string[];
}

/**
 * @deprecated Use AgentSpec instead. Keeping for backward compatibility during migration.
 */
export interface DrakoAgent {
    id: string;
    name: string;
    layer: AgentLayer;
    vertical: AgentVertical;
    description: string;
    capabilities: string[];
    integrations: string[];
    inputs: string[];
    outputs: string[];
}

/**
 * @deprecated Use SwarmPlan instead.
 */
export type SwarmDefinition = {
    core: string[];
    partner: string[];
    operator: string[];
};
