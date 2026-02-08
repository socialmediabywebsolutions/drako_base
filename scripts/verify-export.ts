
import { createSessionValue, SESSION_COOKIE_NAME } from "@/lib/auth/session";

const BASE_URL = "http://localhost:3000";
const TENANT_ID = "test-tenant-ph13";
const ADMIN_EMAIL = "admin@drako.systems";

async function run() {
    console.log("🧩 PHASE 13 VERIFICATION: EXPORT ENGINE (Advanced Auth)");

    // 0. Generate Valid Session Cookie
    // We mock the session creation using the server's secret (assuming we run in same env)
    // If we can't access secret, this fails. But tsx should read .env.local or process.env
    try {
        const cookieVal = await createSessionValue({
            email: ADMIN_EMAIL,
            tenantId: TENANT_ID,
            role: "admin"
        });
        const cookieHeader = `${SESSION_COOKIE_NAME}=${cookieVal}`;

        console.log("🔑 Session Cookie Generated.");

        // 1. Create SaaS
        console.log("\n1. Creating Test SaaS...");
        const slug = `ph13-export-${Date.now()}`;
        const createRes = await fetch(`${BASE_URL}/api/saas`, {
            method: "POST",
            headers: {
                "Content-Type": "application/json",
                "Cookie": cookieHeader,
                "x-drako-tenant-id": TENANT_ID
            },
            body: JSON.stringify({
                name: "Phase 13 Export Test",
                slug: slug
            })
        });

        if (!createRes.ok) {
            console.error("Failed to create SaaS", await createRes.text());
            process.exit(1);
        }
        const saas = await createRes.json();
        const saasId = saas.id || saas.item?.id; // backend response might vary (item vs id directly)

        if (!saasId) {
            console.error("Created SaaS JSON invalid", saas);
            process.exit(1);
        }

        console.log(`✅ SaaS Created: ${saasId} (${slug})`);

        // 2. Request Export
        console.log("\n2. Requesting Export (ZIP)...");
        const exportRes = await fetch(`${BASE_URL}/api/saas/export?saasId=${saasId}`, {
            headers: {
                "Cookie": cookieHeader,
                "x-drako-tenant-id": TENANT_ID
            }
        });

        if (!exportRes.ok) {
            console.error("Export Failed", await exportRes.text());
            process.exit(1);
        }

        const contentType = exportRes.headers.get("content-type");
        const disposition = exportRes.headers.get("content-disposition");
        const length = exportRes.headers.get("content-length"); // might be null if chunked

        console.log(`Response Status: ${exportRes.status}`);
        console.log(`Content-Type: ${contentType}`);
        console.log(`Disposition: ${disposition}`);
        if (length) console.log(`Size: ${length} bytes`);

        if (contentType !== "application/zip") {
            console.error("❌ Invalid Content-Type");
            process.exit(1);
        }

        if (!disposition?.includes("drako-export") || !disposition?.includes(".zip")) {
            console.error("❌ Invalid Filename in Disposition");
            process.exit(1);
        }

        console.log("\n✅ PHASE 13 EXPORT VERIFIED SUCCESSFULLY");

    } catch (e) {
        console.error("Script Error:", e);
        process.exit(1);
    }
}

run();
