-- 0048_drako_domain_status_normalization.sql
-- Normalize saas_domains.status to pending/active/paused and move legacy states into verification_*.

UPDATE saas_domains
SET
  verification_status = CASE
    WHEN verification_status IS NOT NULL AND verification_status != "" THEN lower(verification_status)
    WHEN upper(status) = "ACTIVE" THEN "verified"
    WHEN upper(status) = "PAUSED" THEN "routing_check"
    WHEN upper(status) = "ERROR_CHECK" THEN "failed"
    WHEN upper(status) IN ("PENDING_DNS", "PENDING") THEN "dns_pending"
    ELSE "dns_pending"
  END,
  verification_reason = CASE
    WHEN verification_reason IS NOT NULL AND verification_reason != "" THEN verification_reason
    WHEN upper(status) = "ERROR_CHECK" THEN "legacy_error_check"
    WHEN upper(status) = "PENDING_DNS" THEN "legacy_pending_dns"
    WHEN upper(status) = "PAUSED" THEN "legacy_paused"
    ELSE verification_reason
  END,
  status = CASE
    WHEN upper(status) = "ACTIVE" THEN "active"
    WHEN upper(status) = "PAUSED" THEN "paused"
    ELSE "pending"
  END
WHERE status IS NOT NULL;
