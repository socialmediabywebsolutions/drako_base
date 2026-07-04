#!/usr/bin/env node
/**
 * Post-build patch: injects a Cloudflare Workers `scheduled` handler into the
 * socialflows-standalone worker.js wrapper so that the [triggers] cron in
 * wrangler.workers.toml actually calls /api/cron/social (scheduled publishing)
 * and /api/cron/social/comments (Instagram comment auto-reply) every 5 minutes.
 *
 * The artifact matrix build generates a thin re-export wrapper:
 *   export { default } from "<path>";
 *   export * from "<path>";
 *
 * We turn it into a proper worker that spreads the Open Next default export and
 * adds a scheduled handler, without changing `main` in wrangler.workers.toml.
 */

import fs from "node:fs";
import path from "node:path";

const projectRoot = process.cwd();
const workerPath = path.join(
  projectRoot,
  ".open-next",
  "socialflows-standalone",
  "worker.js",
);

if (!fs.existsSync(workerPath)) {
  console.error(`PATCH_SOCIALFLOW_CRON: worker not found at ${workerPath}`);
  process.exit(1);
}

const original = fs.readFileSync(workerPath, "utf8");

if (original.includes("__socialflowCronHandlerPatched")) {
  console.log("PATCH_SOCIALFLOW_CRON: already applied, skipping");
  process.exit(0);
}

// Extract the re-export path from: export { default } from "<path>";
const match = original.match(/export \{ default \} from "([^"]+)";/);
if (!match) {
  console.error("PATCH_SOCIALFLOW_CRON: could not find re-export path in wrapper");
  console.error("  Content:", original.slice(0, 300));
  process.exit(1);
}

const openNextPath = match[1];

const patched = `// Drako artifact matrix wrapper: generated file, do not edit by hand.
// __socialflowCronHandlerPatched
import __openNextDefault from "${openNextPath}";
export * from "${openNextPath}";
export default {
  ...__openNextDefault,
  async scheduled(_event, env) {
    const appUrl = env.APP_URL ?? "https://socialflows.drako.systems";
    const secret = env.CRON_SECRET ?? "";
    if (!secret) {
      console.error("[Cron] CRON_SECRET not configured — skipping scheduled publish");
      return;
    }
    const authHeaders = { headers: { authorization: "Bearer " + secret } };
    await fetch(appUrl + "/api/cron/social", authHeaders).catch(function(err) {
      console.error("[Cron] scheduled publish failed:", err.message);
    });
    await fetch(appUrl + "/api/cron/social/comments", authHeaders).catch(function(err) {
      console.error("[Cron] scheduled comment auto-reply failed:", err.message);
    });
  },
};
`;

fs.writeFileSync(workerPath, patched, "utf8");
console.log(
  `PATCH_SOCIALFLOW_CRON: scheduled handler injected (importing from ${openNextPath})`,
);
