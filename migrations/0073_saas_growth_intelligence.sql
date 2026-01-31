-- Migration: Growth Intelligence System
-- Enables behavioral tracking and automated analysis for Growth Engine

CREATE TABLE IF NOT EXISTS saas_growth_events (
  id TEXT PRIMARY KEY,
  created_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP,
  tenant_id TEXT NOT NULL,
  saas_id TEXT,
  user_id TEXT,
  
  -- Core Event Data
  event_name TEXT NOT NULL, -- e.g. mentoria.signup, mentoria.first_session
  conversion_source TEXT, -- viral_24h, referral, direct
  country TEXT CHECK(country IN ('ES', 'MX', 'CO', 'AR', 'CL', 'OTHER')) DEFAULT 'OTHER',
  
  -- Extended Payload (JSON)
  -- Stores: edad_alumno, materia_principal, agente_usado_principal, etc.
  payload TEXT,
  
  -- Calculated/Enriched Fields for fast querying
  is_fast_converter BOOLEAN DEFAULT 0,
  session_latency INTEGER DEFAULT 0, -- minutes
  
  FOREIGN KEY (tenant_id) REFERENCES tenants(id),
  FOREIGN KEY (saas_id) REFERENCES saas_projects(id)
);

-- Optimize for time-series analysis per tenant
CREATE INDEX idx_growth_events_tenant_date ON saas_growth_events(tenant_id, created_at DESC);

-- Optimize for event-specific queries (e.g. count conversions)
CREATE INDEX idx_growth_events_name ON saas_growth_events(tenant_id, event_name, created_at DESC);

-- Optimize for geographic segmentation
CREATE INDEX idx_growth_events_geo ON saas_growth_events(tenant_id, country, created_at DESC);
