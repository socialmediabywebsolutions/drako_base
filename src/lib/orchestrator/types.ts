export type StrategicDossier = {
    id: string;
    tenant_id: string;
    version: number;
    status: 'draft' | 'analyzed' | 'active';
    form_data: {
        personal: {
            name: string;
            email: string;
            phone: string;
            country: string;
            city: string;
            address: string;
        };
        business: {
            type: string;
            sector: string;
            years: string;
            employees: string;
            objective: string;
        };
        digital: {
            web: string;
            maps: string;
            instagram: string;
            facebook: string;
            linkedin: string;
            tiktok: string;
        };
        level: string;
    };
    analysis_data?: {
        web_score: number; // 0-100
        verified_maps: boolean;
        competitors_found: number;
        swot: {
            strengths: string[];
            weaknesses: string[];
            opportunities: string[];
            threats: string[];
        };
        recommended_strategy: string; // "Growth", "Efficiency", "Brand"
    };
    plan_data?: SaaSBlueprint;
    created_at: string;
    updated_at: string;
};

export type SaaSBlueprint = {
    architecture: string; // e.g., "B2B CRM", "Marketplace", "LMS"
    tagline: string; // e.g., "The Operating System for Dental Clinics"
    modules: Array<{
        name: string;
        description: string;
        priority: 'critical' | 'high' | 'medium';
    }>;
    stack: {
        frontend: string;
        backend: string;
        database: string;
        hosting: string;
    };
    monetization: {
        model: string; // e.g., "Freemium", "Tiered Subscription"
        tiers: Array<{
            name: string;
            price: string;
            features: string[];
        }>;
    };
    roadmap_steps: string[];
};
