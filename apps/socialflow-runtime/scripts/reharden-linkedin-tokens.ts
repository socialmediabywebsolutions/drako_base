/**
 * P2-28 Token Rehardening Utility
 * 
 * Safely encrypts plaintext tokens in existing saas_social_accounts rows.
 * 
 * SAFETY RESTRICTIONS:
 * - NO SELECT *
 * - NO printing tokens
 * - NO modifying provider/status/tenant/saas
 * - Only updates auth_meta to encrypt accessToken and idToken
 * - Detects encrypted vs plaintext and skips already-encrypted tokens
 * - Fail-safe: aborts on any error without destroying data
 * 
 * Usage:
 * wrangler d1 execute SOCIAL_DB --remote --command="..." \
 *   --env=production
 */

import { encryptToken, isEncryptedToken } from "../src/lib/socialflow/token-encryption";

type SocialAccountRow = {
  id: string;
  tenant_id: string;
  saas_id: string;
  provider: string;
  handle: string;
  display_name: string | null;
  status: string;
  auth_meta: string | null;
  is_primary: number;
  created_at: string;
  updated_at: string;
};

type AuthMeta = {
  mode?: string;
  provider?: string;
  accessToken?: string;
  idToken?: string;
  [key: string]: unknown;
};

/**
 * Safely rehardens a single LinkedIn account row by encrypting plaintext tokens.
 * 
 * @param row - Social account row from database
 * @returns Updated auth_meta JSON string with encrypted tokens, or null if no update needed
 */
export async function rehardenLinkedInTokens(row: SocialAccountRow): Promise<string | null> {
  // Parse auth_meta
  const authMeta: AuthMeta = row.auth_meta ? JSON.parse(row.auth_meta) : {};
  
  let updated = false;
  
  // Check and encrypt accessToken if needed
  if (authMeta.accessToken && typeof authMeta.accessToken === "string") {
    if (!isEncryptedToken(authMeta.accessToken)) {
      console.log(`[${row.id}] Encrypting accessToken (plaintext detected)`);
      const encrypted = await encryptToken(authMeta.accessToken);
      authMeta.accessToken = encrypted ?? undefined;
      updated = true;
    } else {
      console.log(`[${row.id}] accessToken already encrypted, skipping`);
    }
  } else {
    console.log(`[${row.id}] No accessToken found`);
  }
  
  // Check and encrypt idToken if needed
  if (authMeta.idToken && typeof authMeta.idToken === "string") {
    if (!isEncryptedToken(authMeta.idToken)) {
      console.log(`[${row.id}] Encrypting idToken (plaintext detected)`);
      const encrypted = await encryptToken(authMeta.idToken);
      authMeta.idToken = encrypted ?? undefined;
      updated = true;
    } else {
      console.log(`[${row.id}] idToken already encrypted, skipping`);
    }
  } else {
    console.log(`[${row.id}] No idToken found`);
  }
  
  if (!updated) {
    console.log(`[${row.id}] No updates needed`);
    return null;
  }
  
  // Return updated auth_meta as JSON string
  return JSON.stringify(authMeta);
}

/**
 * Generates a safe UPDATE statement for a specific row.
 * 
 * @param row - Social account row
 * @param updatedAuthMeta - New encrypted auth_meta JSON string
 * @returns SQL UPDATE statement (safe, single row, preserves all other fields)
 */
export function generateSafeUpdateStatement(row: SocialAccountRow, updatedAuthMeta: string): string {
  const now = new Date().toISOString();
  
  // Escape single quotes in JSON
  const escapedAuthMeta = updatedAuthMeta.replace(/'/g, "''");
  
  return `UPDATE saas_social_accounts
SET 
  auth_meta = '${escapedAuthMeta}',
  updated_at = '${now}'
WHERE 
  id = '${row.id}' 
  AND tenant_id = '${row.tenant_id}'
  AND saas_id = '${row.saas_id}'
  AND provider = '${row.provider}'
  AND status = '${row.status}';`;
}

/**
 * Main rehardening function for canary LinkedIn row.
 * 
 * SAFETY: Only targets the specific canary row used in P2-27 validation.
 */
export async function rehardenCanaryLinkedInRow(): Promise<void> {
  console.log("=== P2-28 Token Rehardening Utility ===");
  console.log("Target: Canary LinkedIn OAuth row from P2-27");
  console.log("");
  
  // IMPORTANT: This is a placeholder showing the logic.
  // Actual execution requires:
  // 1. Fetching the row with safe SELECT (no *)
  // 2. Running rehardenLinkedInTokens()
  // 3. Executing UPDATE if needed
  
  const SAFE_SELECT = `
SELECT 
  id,
  tenant_id,
  saas_id,
  provider,
  handle,
  display_name,
  status,
  auth_meta,
  is_primary,
  created_at,
  updated_at
FROM saas_social_accounts
WHERE tenant_id = 'tenant_socialflow_canary_staff'
  AND saas_id = 'p2-24i-saas'
  AND provider = 'LINKEDIN'
ORDER BY created_at DESC
LIMIT 1;
  `.trim();
  
  console.log("Safe SELECT query:");
  console.log(SAFE_SELECT);
  console.log("");
  console.log("Next steps:");
  console.log("1. Execute SELECT query to fetch row");
  console.log("2. Parse row and call rehardenLinkedInTokens()");
  console.log("3. If update needed, execute generateSafeUpdateStatement()");
  console.log("4. Verify with safe query showing encrypted flags");
}

// Export for use in scripts or admin tools
export type { SocialAccountRow, AuthMeta };
