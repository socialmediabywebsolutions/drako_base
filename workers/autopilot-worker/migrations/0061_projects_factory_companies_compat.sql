-- 0061_projects_factory_companies_compat.sql
-- Compatibility layer for Projects Factory step 2.
-- Creates read-only views that expose companies/company_domains based on existing SaaS tables.
-- Note: company_id maps to saas_id temporarily while SaaS terminology remains canonical.

PRAGMA foreign_keys = ON;

CREATE VIEW IF NOT EXISTS companies AS
SELECT
  cd.id AS id,
  cd.slug AS slug,
  cd.nombre AS name,
  cd.descripcion AS description,
  NULL AS created_at
FROM core_departments cd;

CREATE VIEW IF NOT EXISTS company_domains AS
SELECT
  sd.id AS id,
  sd.tenant_id AS tenant_id,
  sd.saas_id AS company_id,
  sd.domain AS domain,
  sd.status AS status,
  sd.verification_status AS verification_status,
  sd.verification_reason AS verification_reason,
  sd.retry_count AS retry_count,
  sd.last_checked_at AS last_checked_at,
  sd.created_at AS created_at,
  sd.updated_at AS updated_at
FROM saas_domains sd;
