-- Migration: SaaS Health Metrics
-- Enables automated health scoring for all SaaS projects

CREATE TABLE IF NOT EXISTS saas_health_metrics (
  id TEXT PRIMARY KEY,
  tenant_id TEXT NOT NULL,
  saas_id TEXT NOT NULL,
  
  -- Scores (0-100)
  overall_score INTEGER NOT NULL,
  revenue_score INTEGER NOT NULL,
  retention_score INTEGER NOT NULL,
  technical_score INTEGER NOT NULL,
  feature_utilization_score INTEGER NOT NULL,
  support_score INTEGER NOT NULL,
  
  -- Revenue metrics
  mrr REAL DEFAULT 0,
  mrr_growth_rate REAL DEFAULT 0,
  
  -- Customer metrics
  customer_count INTEGER DEFAULT 0,
  churn_rate REAL DEFAULT 0,
  
  -- Support metrics
  avg_response_time_hours REAL DEFAULT 0,
  
  -- Technical metrics
  uptime_percentage REAL DEFAULT 100,
  avg_api_latency_ms REAL DEFAULT 0,
  error_rate REAL DEFAULT 0,
  
  -- Health assessment
  health_status TEXT CHECK(health_status IN ('healthy', 'warning', 'critical')) NOT NULL,
  recommendation TEXT,
  
  -- Metadata
  calculated_at TEXT NOT NULL,
  created_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP,
  
  FOREIGN KEY (tenant_id) REFERENCES tenants(id),
  FOREIGN KEY (saas_id) REFERENCES saas_projects(id)
);

CREATE INDEX idx_health_metrics_saas ON saas_health_metrics(saas_id, calculated_at DESC);
CREATE INDEX idx_health_metrics_status ON saas_health_metrics(health_status);
CREATE INDEX idx_health_metrics_score ON saas_health_metrics(overall_score DESC);
CREATE INDEX idx_health_metrics_tenant ON saas_health_metrics(tenant_id, calculated_at DESC);

-- View for latest health scores
CREATE VIEW IF NOT EXISTS v_latest_health_scores AS
SELECT 
  h.*,
  p.name as saas_name,
  p.slug as saas_slug
FROM saas_health_metrics h
INNER JOIN saas_projects p ON h.saas_id = p.id
WHERE h.id IN (
  SELECT id
  FROM saas_health_metrics h2
  WHERE h2.saas_id = h.saas_id
  ORDER BY h2.calculated_at DESC
  LIMIT 1
);
