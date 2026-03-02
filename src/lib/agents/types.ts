export interface AgentWorkLog {
    id: string;
    tenant_id: string;
    saas_id: string;
    agent_name: 'MARKETING_BOT' | 'SEO_OPTIMIZER';
    action_type: 'GENERATE_POSTS' | 'KEYWORD_RESEARCH';
    status: 'READY' | 'EXECUTED' | 'BLOCKED';
    output_json: any;
    cost_eur: number;
    created_at: string;
}

export interface AgentContext {
    saas_id: string;
    tenant_id: string;
    dossier: any; // Using any for flexibility with stored JSON
}

export type AgentVertical = 'GENERIC' | 'SOCIAL_MARKETING' | 'REAL_ESTATE';
export type PackId = 'starter' | 'pro' | 'full';
export type AgentLayer = "CORE" | "PARTNER" | "OPERATOR" | "INFRA";

export type AgentSpec = {
    agent_id: string;
    label: string;
    layer: AgentLayer;
    verticals: AgentVertical[];
    version: string;
    mission: string;
    responsibilities: string[];
    boundaries: string[];
    outputs_desc: string[];
    input_schema: Record<string, unknown>;
    output_schema: Record<string, unknown>;
    permissions: Record<string, unknown>;
    emits: string[];
    consumes: string[];
    retry_policy: { attempts: number; backoff: "exponential" | "linear" | "none" | "fixed" };
    idempotency_strategy: string;
    kpis: Array<{ metric: string; description: string }>;
    guardrails: Record<string, unknown>;
    default_enabled_by_pack: Record<PackId, boolean>;
    dependencies: string[];
    rate_limits?: Record<string, unknown>;
};

export type SwarmPlan = {
    vertical: AgentVertical;
    pack: PackId;
    agent_ids: string[];
};
