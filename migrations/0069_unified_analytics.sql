-- Migration: Unified Analytics System
-- Enables consolidated metrics tracking across all SaaS in the holding

CREATE TABLE IF NOT EXISTS holding_metrics_snapshots (
  id TEXT PRIMARY KEY,
  tenant_id TEXT NOT NULL,
  
  -- Financial Metrics
  total_mrr REAL NOT NULL DEFAULT 0,
  total_arr REAL NOT NULL DEFAULT 0,
  avg_churn_rate REAL DEFAULT 0,
  total_ltv REAL DEFAULT 0,
  total_cac REAL DEFAULT 0,
  
  -- Operational Metrics
  active_saas_count INTEGER NOT NULL DEFAULT 0,
  total_customers INTEGER NOT NULL DEFAULT 0,
  total_active_subscriptions INTEGER NOT NULL DEFAULT 0,
  total_projects INTEGER NOT NULL DEFAULT 0,
  
  -- Technical Metrics
  total_api_requests INTEGER DEFAULT 0,
  total_ai_tokens INTEGER DEFAULT 0,
  total_d1_queries INTEGER DEFAULT 0,
  avg_edge_duration_ms REAL DEFAULT 0,
  
  -- Growth Metrics
  mrr_growth_rate REAL DEFAULT 0,
  customer_growth_rate REAL DEFAULT 0,
  new_saas_this_month INTEGER DEFAULT 0,
  
  -- Per-SaaS breakdown (JSON array)
  saas_breakdown_json TEXT NOT NULL,
  
  -- Metadata
  snapshot_date TEXT NOT NULL,
  snapshot_type TEXT CHECK(snapshot_type IN ('daily', 'weekly', 'monthly')) DEFAULT 'daily',
  created_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP,
  
  FOREIGN KEY (tenant_id) REFERENCES tenants(id)
);

CREATE TABLE IF NOT EXISTS saas_daily_metrics (
  id TEXT PRIMARY KEY,
  tenant_id TEXT NOT NULL,
  saas_id TEXT NOT NULL,
  
  -- Daily metrics
  mrr REAL DEFAULT 0,
  active_customers INTEGER DEFAULT 0,
  active_subscriptions INTEGER DEFAULT 0,
  new_customers INTEGER DEFAULT 0,
  churned_customers INTEGER DEFAULT 0,
  
  -- Activity metrics
  api_requests INTEGER DEFAULT 0,
  ai_tokens_used INTEGER DEFAULT 0,
  errors_count INTEGER DEFAULT 0,
  
  -- Date
  metric_date TEXT NOT NULL,
  created_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP,
  
  FOREIGN KEY (tenant_id) REFERENCES tenants(id),
  FOREIGN KEY (saas_id) REFERENCES saas_projects(id),
  
  UNIQUE(saas_id, metric_date)
);

CREATE INDEX idx_holding_snapshots_tenant_date ON holding_metrics_snapshots(tenant_id, snapshot_date DESC);
CREATE INDEX idx_holding_snapshots_type ON holding_metrics_snapshots(snapshot_type, snapshot_date DESC);
CREATE INDEX idx_saas_daily_metrics ON saas_daily_metrics(saas_id, metric_date DESC);
CREATE INDEX idx_saas_daily_metrics_tenant ON saas_daily_metrics(tenant_id, metric_date DESC);

-- View for latest holding metrics
CREATE VIEW IF NOT EXISTS v_latest_holding_metrics AS
SELECT *
FROM holding_metrics_snapshots
WHERE id IN (
  SELECT id
  FROM holding_metrics_snapshots h2
  WHERE h2.tenant_id = holding_metrics_snapshots.tenant_id
    AND h2.snapshot_type = 'daily'
  ORDER BY h2.snapshot_date DESC
  LIMIT 1
);

-- View for SaaS performance comparison
CREATE VIEW IF NOT EXISTS v_saas_performance AS
SELECT 
  p.id as saas_id,
  p.name as saas_name,
  p.slug as saas_slug,
  p.vertical,
  p.status,
  h.overall_score as health_score,
  h.health_status,
  m.mrr,
  m.active_customers,
  m.active_subscriptions,
  m.metric_date
FROM saas_projects p
LEFT JOIN (
  SELECT saas_id, overall_score, health_status
  FROM saas_health_metrics
  WHERE id IN (
    SELECT id FROM saas_health_metrics h
    WHERE h.saas_id = saas_health_metrics.saas_id
    ORDER BY calculated_at DESC
    LIMIT 1
  )
) h ON p.id = h.saas_id
LEFT JOIN (
  SELECT saas_id, mrr, active_customers, active_subscriptions, metric_date
  FROM saas_daily_metrics
  WHERE id IN (
    SELECT id FROM saas_daily_metrics m
    WHERE m.saas_id = saas_daily_metrics.saas_id
    ORDER BY metric_date DESC
    LIMIT 1
  )
) m ON p.id = m.saas_id
WHERE p.status = 'active';
