-- Migration: 0110_orchestrator_dossier.sql
-- Description: Stores the Strategic Form, Analysis, and Plan data for the Orchestrator.

CREATE TABLE IF NOT EXISTS tenant_strategic_dossiers (
    id TEXT PRIMARY KEY,
    tenant_id TEXT NOT NULL REFERENCES tenants(id),
    version INTEGER NOT NULL DEFAULT 1,
    status TEXT NOT NULL DEFAULT 'draft', -- draft, analyzed, active
    
    -- STEP 1: Form Data (JSON)
    -- { personal: {}, business: {}, digital: {}, objectives: [], departments: [] }
    form_data TEXT, 

    -- STEP 2: Auto Analysis (JSON)
    -- { maps_competitors: [], web_score: 0.8, ... }
    analysis_data TEXT,

    -- STEP 3: Generated Plan (JSON)
    -- { architecture: [], modules: [], roadmap: [] }
    plan_data TEXT,

    metadata TEXT, -- Extra context
    created_at TEXT NOT NULL DEFAULT (strftime('%Y-%m-%dT%H:%M:%fZ','now')),
    updated_at TEXT NOT NULL DEFAULT (strftime('%Y-%m-%dT%H:%M:%fZ','now'))
);

CREATE INDEX IF NOT EXISTS idx_dossiers_tenant ON tenant_strategic_dossiers(tenant_id);
