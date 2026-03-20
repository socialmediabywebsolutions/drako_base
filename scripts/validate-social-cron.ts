import fs from "fs";
import path from "path";

// 1. Load environment variables from .env.local manually (avoiding dotenv dependency)
const envPath = path.resolve(process.cwd(), ".env.local");
if (fs.existsSync(envPath)) {
  console.log("Loading .env.local...");
  const content = fs.readFileSync(envPath, "utf8");
  content.split("\n").forEach((line) => {
    const trimmed = line.trim();
    if (!trimmed || trimmed.startsWith("#")) return;
    
    // Simple parser: KEY=VALUE
    const firstEquals = trimmed.indexOf("=");
    if (firstEquals === -1) return;
    
    const key = trimmed.slice(0, firstEquals).trim();
    let value = trimmed.slice(firstEquals + 1).trim();
    
    // Remove surrounding quotes if present
    if ((value.startsWith('"') && value.endsWith('"')) || (value.startsWith("'") && value.endsWith("'"))) {
      value = value.slice(1, -1);
    }
    
    if (!process.env[key]) {
      process.env[key] = value;
    }
  });
}

const CRON_SECRET = process.env.CRON_SECRET || process.env.INTERNAL_API_SECRET;
const BASE_URL = process.env.NEXT_PUBLIC_APP_URL || "http://localhost:3000";

if (!CRON_SECRET) {
  console.error("❌ Error: CRON_SECRET or INTERNAL_API_SECRET not found in .env.local");
  process.exit(1);
}

async function validateSocialCron() {
  console.log("🚀 Validating SocialFlow Cron Route...");
  console.log(`Target: ${BASE_URL}/api/cron/social`);
  // Mask secret for logging
  const maskedSecret = CRON_SECRET.slice(0, 4) + "*".repeat(Math.max(0, CRON_SECRET.length - 8)) + CRON_SECRET.slice(-4);
  console.log(`Using Token: ${maskedSecret} (Length: ${CRON_SECRET.length})`);

  try {
    // Use global fetch (available in Node.js 18+)
    const response = await fetch(`${BASE_URL}/api/cron/social`, {
      method: "GET",
      headers: {
        "Authorization": `Bearer ${CRON_SECRET}`,
        "Content-Type": "application/json",
      },
    });

    const status = response.status;
    const text = await response.text();

    console.log(`\nResponse Status: ${status}`);
    
    let json;
    try {
      json = JSON.parse(text);
      console.log("Response Body:", JSON.stringify(json, null, 2));
    } catch {
      console.log("Response Body (Text):", text);
    }

    if (status === 200 && json?.success === true) {
      console.log("\n✅ SUCCESS: Cron route authenticated and executed successfully.");
      if (json.processed > 0) {
        console.log(`   Processed ${json.processed} posts.`);
      } else {
        console.log("   No due posts were found (this is normal if queue is empty).");
      }
    } else if (status === 401 || status === 403) {
      console.error("\n❌ FAILURE: Authentication failed. Check your CRON_SECRET.");
      console.error("   Ensure the secret in .env.local matches exactly what the code expects.");
    } else {
      console.error("\n⚠️ WARNING: Cron route executed but returned unexpected status/body.");
    }

  } catch (error) {
    console.error("\n❌ NETWORK ERROR: Could not reach the cron endpoint.");
    console.error("Make sure the Next.js development server is running on localhost:3000");
    console.error(`Error details: ${error}`);
  }
}

validateSocialCron();
