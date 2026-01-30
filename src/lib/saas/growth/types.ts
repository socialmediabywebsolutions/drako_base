export type GrowthEventName =
    | 'mentoria.signup'
    | 'mentoria.first_session'
    | 'mentoria.badge_unlocked'
    | 'mentoria.converted'
    | 'mentoria.churn_risk';

export type GrowthConversionSource = 'viral_24h' | 'referral' | 'direct' | 'other';

export type GrowthCountryCode = 'ES' | 'MX' | 'CO' | 'AR' | 'CL' | 'OTHER';

export interface GrowthEventPayload {
    edad_alumno?: number; // 6-18
    materia_principal?: string;
    agente_usado_principal?: 'tutor' | 'cognitivo' | 'psicologo';
    latencia_sesion?: number; // minutes
    intensidad_24h?: number; // number of messages
    referral_code?: string;
    [key: string]: any;
}

export interface GrowthEvent {
    id: string;
    created_at: string; // ISO timestamp
    tenant_id: string;
    saas_id?: string;
    user_id?: string;
    event_name: GrowthEventName;
    conversion_source?: GrowthConversionSource;
    country: GrowthCountryCode;
    payload: GrowthEventPayload;
    is_fast_converter: boolean;
    session_latency?: number;
}

export interface GrowthAnalysisResult {
    top_converters: {
        winning_messages: string[];
        sticky_subjects: string[];
    };
    archetypes: {
        loyal: string[]; // Characteristics of loyal users
        churn_risk: string[]; // Characteristics of churn risk
    };
    opportunities: GrowthOpportunity[];
}

export interface GrowthOpportunity {
    id: string;
    type: 'PATTERN_REPEATED' | 'ENGAGEMENT_ANOMALY' | 'VIRAL_GEO';
    description: string;
    recommendation: string;
    confidence_score: number;
    metadata?: any;
}
