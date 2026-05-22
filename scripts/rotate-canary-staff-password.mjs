#!/usr/bin/env node

/**
 * Rotate Canary Staff Password
 * Generates a new secure temporary password for socialflow-canary-staff+p2-24f@drako.systems
 * and outputs the SQL UPDATE command to execute via wrangler d1 execute.
 */

const ITERATIONS = 100000;
const EMAIL = "socialflow-canary-staff+p2-24f@drako.systems";

function bytesToBase64(bytes) {
  const binString = Array.from(bytes, (byte) => String.fromCharCode(byte)).join("");
  return Buffer.from(binString, 'binary').toString('base64');
}

async function hashPassword(password) {
  const salt = crypto.getRandomValues(new Uint8Array(16));
  const encoder = new TextEncoder();

  const key = await crypto.subtle.importKey(
    "raw",
    encoder.encode(password),
    { name: "PBKDF2" },
    false,
    ["deriveBits"]
  );

  const bits = await crypto.subtle.deriveBits(
    {
      name: "PBKDF2",
      salt,
      iterations: ITERATIONS,
      hash: "SHA-256",
    },
    key,
    256
  );

  return {
    hash: bytesToBase64(new Uint8Array(bits)),
    salt: bytesToBase64(salt),
    iterations: ITERATIONS,
  };
}

function generateSecurePassword(length = 24) {
  const chars = 'ABCDEFGHJKLMNPQRSTUVWXYZabcdefghjkmnpqrstuvwxyz23456789!@#$%^&*-_=+';
  const array = crypto.getRandomValues(new Uint8Array(length));
  return Array.from(array, byte => chars[byte % chars.length]).join('');
}

async function main() {
  console.log('='.repeat(80));
  console.log('SOCIALFLOW CANARY STAFF PASSWORD ROTATION');
  console.log('='.repeat(80));
  console.log('');
  console.log('User:', EMAIL);
  console.log('Database:', 'SOCIALFLOW_AUTHS_DB (socialflows_auths_db)');
  console.log('');

  // Generate new password
  const newPassword = generateSecurePassword(24);
  console.log('New temporary password generated (24 characters, secure random)');
  console.log('');

  // Hash password
  const { hash, salt, iterations } = await hashPassword(newPassword);
  
  console.log('Password hashed:');
  console.log('  Algorithm: PBKDF2-SHA256');
  console.log('  Iterations:', iterations);
  console.log('  Salt length:', salt.length, 'chars (base64)');
  console.log('  Hash length:', hash.length, 'chars (base64)');
  console.log('');

  // Generate SQL
  const now = new Date().toISOString();
  const sql = `
UPDATE socialflow_credentials
SET 
  hash = '${hash}',
  salt = '${salt}',
  iterations = ${iterations},
  algo = 'PBKDF2-SHA256',
  updated_at = '${now}'
WHERE user_id = (
  SELECT id FROM socialflow_users WHERE email = '${EMAIL}'
);
`.trim();

  console.log('='.repeat(80));
  console.log('STEP 1: Execute SQL via wrangler');
  console.log('='.repeat(80));
  console.log('');
  console.log('wrangler d1 execute socialflows_auths_db --remote --command "\\');
  console.log(sql.split('\n').map((line, i) => i === 0 ? line : '  ' + line).join('\n'));
  console.log('"');
  console.log('');

  console.log('='.repeat(80));
  console.log('STEP 2: Verify update');
  console.log('='.repeat(80));
  console.log('');
  console.log('wrangler d1 execute socialflows_auths_db --remote --command "\\');
  console.log(`  SELECT u.email, c.algo, c.iterations, datetime(c.updated_at) as updated`);
  console.log(`  FROM socialflow_users u`);
  console.log(`  JOIN socialflow_credentials c ON c.user_id = u.id`);
  console.log(`  WHERE u.email = '${EMAIL}'`);
  console.log('"');
  console.log('');

  console.log('='.repeat(80));
  console.log('STEP 3: Test login');
  console.log('='.repeat(80));
  console.log('');
  console.log('URL: https://socialflow-canary.drako.systems/socialflow/auth?canaryGate=<GATE_TOKEN>');
  console.log('Email:', EMAIL);
  console.log('Password:', newPassword);
  console.log('');
  console.log('Expected:');
  console.log('  - Cookie: __Host-socialflow_canary_session');
  console.log('  - Redirect to: /socialflow');
  console.log('  - Access to: /socialflow/profile, /socialflow/ai, /socialflow/settings/*');
  console.log('');

  console.log('='.repeat(80));
  console.log('SECURITY NOTICE');
  console.log('='.repeat(80));
  console.log('');
  console.log('⚠️  This password is TEMPORARY for P2-26 smoke testing only.');
  console.log('⚠️  Rotate again after smoke completion.');
  console.log('⚠️  Do NOT commit this password to git.');
  console.log('⚠️  Do NOT share via insecure channels.');
  console.log('⚠️  Use secure password manager or delete after use.');
  console.log('');
  console.log('='.repeat(80));
}

main().catch(console.error);
