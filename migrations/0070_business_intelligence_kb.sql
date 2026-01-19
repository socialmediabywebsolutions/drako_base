-- Migration: Business Intelligence Knowledge Base
-- Description: Almacena info fiscal, gastos operativos y análisis de redes sociales.

CREATE TABLE IF NOT EXISTS company_business_intelligence (
    id TEXT PRIMARY KEY,
    tenant_id TEXT NOT NULL,
    company_id TEXT NOT NULL,
    
    -- Huella Digital
    social_profiles_json TEXT, -- { facebook: string, instagram: string, linkedin: string }
    social_analysis_json TEXT, -- { followers: number, audit_summary: string, engagement_rate: number }
    
    -- Geo Localización
    physical_address TEXT,
    competitors_analysis_json TEXT, -- { nearby: string[], market_share_estimated: number }
    
    -- Estructura de Costos (Mensuales)
    rent_mortgage REAL DEFAULT 0,
    electricity REAL DEFAULT 0,
    water REAL DEFAULT 0,
    gas REAL DEFAULT 0,
    labor_costs REAL DEFAULT 0,
    other_expenses REAL DEFAULT 0,
    
    -- Info Fiscal
    tax_id TEXT,
    fiscal_address TEXT,
    
    -- Análisis Drako
    drako_proposal_json TEXT, -- { situational_analysis: string, improvement_plan: string, budget: number }
    
    created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
    updated_at DATETIME DEFAULT CURRENT_TIMESTAMP
);

CREATE INDEX IF NOT EXISTS idx_bi_tenant ON company_business_intelligence(tenant_id);
