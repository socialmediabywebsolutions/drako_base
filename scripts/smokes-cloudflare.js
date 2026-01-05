// Simple smoke runner for Cloudflare preview/deploy.
// Usage: BASE_URL=http://localhost:8787 node scripts/smokes-cloudflare.js

const baseUrl = process.env.BASE_URL ?? "http://localhost:8787";

const targets = [
  "/admin",
  "/api/health",
  "/api/agents",
  "/api/saas",
];

async function run() {
  let failed = false;
  for (const path of targets) {
    const url = `${baseUrl}${path}`;
    try {
      const res = await fetch(url, { method: "GET" });
      console.log(path, res.status);
      if (res.status !== 200) {
        failed = true;
      }
    } catch (error) {
      console.error(path, "ERROR", error);
      failed = true;
    }
  }
  if (failed) {
    console.error("Smoke tests failed");
    process.exit(1);
  } else {
    console.log("Smoke tests passed");
  }
}

run();
