-- Seed Drako Systems and Drako Clinic Pack as real SaaS projects + domains (idempotent)

-- Drako Clinic Pack (blueprint/demo)
INSERT INTO saas (id, name, slug, domain, subdomain, status, tenant_id, public_domain, public_subdomain, domain_status)
VALUES ('saas_drako_clinic_pack', 'Drako Clinic Pack', 'drako-clinic-pack', NULL, 'clinic-pack', 'active', 'demo-tenant', NULL, 'clinic-pack', 'pending')
ON CONFLICT(id) DO UPDATE SET
  name = excluded.name,
  slug = excluded.slug,
  status = excluded.status,
  tenant_id = excluded.tenant_id,
  public_subdomain = excluded.public_subdomain,
  domain_status = excluded.domain_status;

INSERT INTO saas_projects (id, tenant_id, slug, display_name, status, created_at, updated_at)
VALUES ('saas_proj_drako_clinic_pack', 'demo-tenant', 'drako-clinic-pack', 'Drako Clinic Pack', 'active', strftime('%Y-%m-%dT%H:%M:%fZ','now'), strftime('%Y-%m-%dT%H:%M:%fZ','now'))
ON CONFLICT(id) DO UPDATE SET
  slug = excluded.slug,
  display_name = excluded.display_name,
  status = excluded.status,
  updated_at = excluded.updated_at;

INSERT INTO saas_domains (id, tenant_id, saas_id, domain, is_primary, status, last_checked_at, created_at, updated_at, verification_status, verification_reason, retry_count, verification_token, last_error)
VALUES ('saas_domain_drako_clinic_pack', 'demo-tenant', 'saas_drako_clinic_pack', 'clinic.drako.local', 1, 'pending', strftime('%Y-%m-%dT%H:%M:%fZ','now'), strftime('%Y-%m-%dT%H:%M:%fZ','now'), strftime('%Y-%m-%dT%H:%M:%fZ','now'), 'pending_dns', NULL, 0, 'verify_drako_clinic_pack', NULL)
ON CONFLICT(id) DO UPDATE SET
  domain = excluded.domain,
  is_primary = excluded.is_primary,
  status = excluded.status,
  verification_status = excluded.verification_status,
  last_checked_at = excluded.last_checked_at,
  updated_at = excluded.updated_at,
  verification_token = excluded.verification_token;

-- Drako.Systems (público)
INSERT INTO saas (id, name, slug, domain, subdomain, status, tenant_id, public_domain, public_subdomain, domain_status)
VALUES ('saas_drako_systems', 'Drako.Systems', 'drako-systems', 'drako.systems', 'drako-systems', 'active', 'demo-tenant', 'drako.systems', 'drako-systems', 'pending')
ON CONFLICT(id) DO UPDATE SET
  name = excluded.name,
  slug = excluded.slug,
  domain = excluded.domain,
  subdomain = excluded.subdomain,
  status = excluded.status,
  tenant_id = excluded.tenant_id,
  public_domain = excluded.public_domain,
  public_subdomain = excluded.public_subdomain,
  domain_status = excluded.domain_status;

INSERT INTO saas_projects (id, tenant_id, slug, display_name, status, created_at, updated_at)
VALUES ('saas_proj_drako_systems', 'demo-tenant', 'drako-systems', 'Drako.Systems', 'active', strftime('%Y-%m-%dT%H:%M:%fZ','now'), strftime('%Y-%m-%dT%H:%M:%fZ','now'))
ON CONFLICT(id) DO UPDATE SET
  slug = excluded.slug,
  display_name = excluded.display_name,
  status = excluded.status,
  updated_at = excluded.updated_at;

INSERT INTO saas_domains (id, tenant_id, saas_id, domain, is_primary, status, last_checked_at, created_at, updated_at, verification_status, verification_reason, retry_count, verification_token, last_error)
VALUES ('saas_domain_drako_systems', 'demo-tenant', 'saas_drako_systems', 'drako.systems', 1, 'pending', strftime('%Y-%m-%dT%H:%M:%fZ','now'), strftime('%Y-%m-%dT%H:%M:%fZ','now'), strftime('%Y-%m-%dT%H:%M:%fZ','now'), 'pending_dns', NULL, 0, 'verify_drako_systems', NULL)
ON CONFLICT(id) DO UPDATE SET
  domain = excluded.domain,
  is_primary = excluded.is_primary,
  status = excluded.status,
  verification_status = excluded.verification_status,
  last_checked_at = excluded.last_checked_at,
  updated_at = excluded.updated_at,
  verification_token = excluded.verification_token;
