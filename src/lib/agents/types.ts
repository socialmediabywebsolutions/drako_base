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
