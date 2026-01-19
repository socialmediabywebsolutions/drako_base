import Stripe from "stripe";
import { resolve } from "path";
import fs from "fs";

// Simple manual .env parser to avoid 'dotenv' dependency issues
function loadEnv(filePath: string) {
  if (!fs.existsSync(filePath)) return;
  const content = fs.readFileSync(filePath, "utf-8");
  content.split("\n").forEach(line => {
    const match = line.match(/^\s*([\w_]+)\s*=\s*(.*)?\s*$/);
    if (match) {
      const key = match[1];
      let value = match[2] || "";
      // Remove quotes if present
      if (value.startsWith('"') && value.endsWith('"')) value = value.slice(1, -1);
      else if (value.startsWith("'") && value.endsWith("'")) value = value.slice(1, -1);
      process.env[key] = value;
    }
  });
}

// Load .env.local if present
loadEnv(resolve(process.cwd(), ".env.local"));

async function validateStripe() {
  console.log("\n--- Validating Stripe Credentials ---");
  const key = process.env.STRIPE_SECRET_KEY;
  if (!key) {
    console.error("❌ STRIPE_SECRET_KEY is missing.");
    return;
  }

  try {
    const stripe = new Stripe(key, { apiVersion: "2024-12-18.acacia" as any }); // Use compatible version or latest
    const account = await stripe.accounts.retrieve();
    console.log(`✅ Stripe Connection Successful!`);
    console.log(`   Account ID: ${account.id}`);
    console.log(`   Mode: ${key.startsWith("sk_test") ? "TEST (Safe)" : "LIVE (Warning!)"}`);
  } catch (error: any) {
    console.error(`❌ Stripe Error: ${error.message}`);
  }
}

async function validateCloudflare() {
  console.log("\n--- Validating Cloudflare Credentials ---");
  const token = process.env.CLOUDFLARE_API_TOKEN || process.env.CF_API_TOKEN;
  const zoneId = process.env.CLOUDFLARE_ZONE_ID || process.env.CF_ZONE_ID;

  if (!token) {
    console.error("❌ CLOUDFLARE_API_TOKEN is missing.");
    return;
  }

  try {
    const headers = {
      Authorization: `Bearer ${token}`,
      "Content-Type": "application/json",
    };

    // 1. Verify Token Validity (and identity)
    const verifyRes = await fetch("https://api.cloudflare.com/client/v4/user/tokens/verify", { headers });
    const verifyData = await verifyRes.json() as any;

    if (!verifyData.success) {
      console.error(`❌ Cloudflare Token Invalid: ${verifyData.errors?.[0]?.message}`);
      return;
    }
    console.log(`✅ Cloudflare Token Verified (Status: ${verifyData.result.status})`);

    // 2. Verify Zone Access (if Zone ID provided)
    if (zoneId) {
      const zoneRes = await fetch(`https://api.cloudflare.com/client/v4/zones/${zoneId}`, { headers });
      const zoneData = await zoneRes.json() as any;
      if (zoneData.success) {
        console.log(`✅ Zone Access Verified: ${zoneData.result.name} (ID: ${zoneData.result.id})`);

        // 3. Check DNS Permissions (Dry check by listing)
        const dnsRes = await fetch(`https://api.cloudflare.com/client/v4/zones/${zoneId}/dns_records?per_page=1`, { headers });
        const dnsData = await dnsRes.json() as any;
        if (dnsData.success) {
          console.log("✅ DNS Read Permission Verified");
        } else {
          console.warn("⚠️  DNS Read Permission Failed (might affect factory)");
        }

      } else {
        console.error(`❌ Zone Access Failed: ${zoneData.errors?.[0]?.message}`);
      }
    } else {
      console.warn("⚠️  CLOUDFLARE_ZONE_ID not provided. Skipping zone access check.");
    }

  } catch (error: any) {
    console.error(`❌ Cloudflare Check Error: ${error.message}`);
  }
}

async function main() {
  console.log("Starting Credential Validation...");
  await validateStripe();
  await validateCloudflare();
  console.log("\nDone.");
}

main().catch(console.error);
