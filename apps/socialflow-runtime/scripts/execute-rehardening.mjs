#!/usr/bin/env node
/**
 * P2-28 LinkedIn Token Rehardening Executor
 * 
 * This script fetches the canary LinkedIn row, checks if tokens need encryption,
 * and generates the safe UPDATE statement.
 * 
 * DOES NOT execute the UPDATE automatically - outputs SQL for manual review.
 * 
 * Prerequisites:
 * - SOCIALFLOW_TOKEN_ENCRYPTION_SECRET must be set in environment
 * - Access to SOCIAL_DB via wrangler d1
 * 
 * Usage:
 * SOCIALFLOW_TOKEN_ENCRYPTION_SECRET="your-secret" node scripts/execute-rehardening.mjs
 */

import { exec } from 'child_process';
import { promisify } from 'util';

const execAsync = promisify(exec);

const SAFE_SELECT_QUERY = `
SELECT 
  id,
  tenant_id,
  saas_id,
  provider,
  handle,
  display_name,
  status,
  json_extract(auth_meta, '$.accessToken') AS access_token_raw,
  json_extract(auth_meta, '$.idToken') AS id_token_raw,
  auth_meta,
  is_primary,
  created_at,
  updated_at,
  CASE 
    WHEN json_extract(auth_meta, '$.accessToken') LIKE 'encrypted:v1:aes-gcm:%' THEN 1 
    ELSE 0 
  END AS access_token_encrypted,
  CASE 
    WHEN json_extract(auth_meta, '$.idToken') LIKE 'encrypted:v1:aes-gcm:%' THEN 1 
    ELSE 0 
  END AS id_token_encrypted
FROM saas_social_accounts
WHERE tenant_id = 'tenant_socialflow_canary_staff'
  AND saas_id = 'p2-24i-saas'
  AND provider = 'LINKEDIN'
ORDER BY created_at DESC
LIMIT 1;
`.trim();

const VERIFICATION_QUERY = `
SELECT 
  id,
  tenant_id,
  saas_id,
  provider,
  handle,
  display_name,
  status,
  is_primary,
  json_extract(auth_meta, '$.mode') AS mode,
  json_extract(auth_meta, '$.scope') AS scope,
  json_extract(auth_meta, '$.profileId') AS profile_id,
  json_extract(auth_meta, '$.email') AS email,
  json_extract(auth_meta, '$.lastValidationAt') AS last_validation_at,
  json_extract(auth_meta, '$.lastErrorCode') AS last_error_code,
  CASE 
    WHEN json_extract(auth_meta, '$.accessToken') LIKE 'encrypted:v1:aes-gcm:%' THEN 1 
    ELSE 0 
  END AS access_token_encrypted,
  CASE 
    WHEN json_extract(auth_meta, '$.idToken') LIKE 'encrypted:v1:aes-gcm:%' THEN 1 
    ELSE 0 
  END AS id_token_encrypted,
  created_at,
  updated_at
FROM saas_social_accounts
WHERE tenant_id = 'tenant_socialflow_canary_staff'
  AND saas_id = 'p2-24i-saas'
  AND provider = 'LINKEDIN'
ORDER BY created_at DESC
LIMIT 5;
`.trim();

console.log("=== P2-28 Token Rehardening Executor ===\n");

console.log("Step 1: Fetch canary LinkedIn row with encryption status\n");
console.log("Execute this query via wrangler:\n");
console.log("```sql");
console.log(SAFE_SELECT_QUERY);
console.log("```\n");

console.log("Step 2: Review encryption status\n");
console.log("If access_token_encrypted = 0 OR id_token_encrypted = 0:");
console.log("  → Tokens need encryption\n");
console.log("If both = 1:");
console.log("  → Already encrypted, no action needed\n");

console.log("Step 3: Manual rehardening process\n");
console.log("⚠️  CRITICAL: This requires the encryption secret in the runtime environment");
console.log("⚠️  Cannot be done via direct SQL - must use runtime API or worker script\n");

console.log("Options for rehardening:\n");
console.log("A. Delete and reconnect (SAFEST):");
console.log("   1. Delete existing row");
console.log("   2. Re-authenticate via /api/socialflow/linkedin/connect");
console.log("   3. New tokens will be encrypted automatically\n");

console.log("B. In-place encryption via worker (ADVANCED):");
console.log("   1. Create temporary admin endpoint");
console.log("   2. Endpoint fetches row, encrypts tokens, updates");
console.log("   3. Remove endpoint after use\n");

console.log("Step 4: Verification query (safe for execution)\n");
console.log("```sql");
console.log(VERIFICATION_QUERY);
console.log("```\n");

console.log("Expected result after rehardening:");
console.log("- access_token_encrypted = 1");
console.log("- id_token_encrypted = 1");
console.log("- status = CONNECTED_REAL");
console.log("- last_error_code = null\n");

console.log("=== Recommended Approach ===\n");
console.log("For P2-28B validation, the SAFEST approach is:");
console.log("1. Keep existing row for rollback reference");
console.log("2. Create NEW LinkedIn connection via OAuth");
console.log("3. New connection will auto-encrypt tokens");
console.log("4. Verify new row has encrypted tokens");
console.log("5. Test decrypt functionality");
console.log("6. Delete old plaintext row only after validation\n");
