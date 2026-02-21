import { spawn } from "child_process";

const BASE_URL = "http://localhost:3000";
const TENANT_ID = "test-tenant-ph13";

async function run() {
    console.log("🧩 PHASE 13 VERIFICATION: EXPORT ENGINE");

    // 1. Create SaaS
    console.log("\n1. Creating Test SaaS...");
    const slug = `ph13-export-${Date.now()}`;
    const createRes = await fetch(`${BASE_URL}/api/saas`, {
        method: "POST",
        headers: {
            "Content-Type": "application/json",
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
    const s = saas as any;
    console.log(`✅ SaaS Created: ${s.id} (${s.slug})`);

    // 2. Request Export
    console.log("\n2. Requesting Export (ZIP)...");
    const exportRes = await fetch(`${BASE_URL}/api/saas/export?saasId=${s.id}`, {
        headers: {
            "x-drako-tenant-id": TENANT_ID
        }
    });

    if (!exportRes.ok) {
        console.error("Export Failed", await exportRes.text());
        process.exit(1);
    }

    const contentType = exportRes.headers.get("content-type");
    const disposition = exportRes.headers.get("content-disposition");
    const length = exportRes.headers.get("content-length");

    console.log(`Response Status: ${exportRes.status}`);
    console.log(`Content-Type: ${contentType}`);
    console.log(`Disposition: ${disposition}`);
    console.log(`Size: ${length} bytes`);

    if (contentType !== "application/zip") {
        console.error("❌ Invalid Content-Type");
        process.exit(1);
    }

    if (!disposition?.includes(`.zip`)) {
        console.error("❌ Invalid Filename in Disposition");
        process.exit(1);
    }

    // 3. (Optional) Verify Archiving manually or via future admin API
    console.log("\n⚠️ Archiving Check: Logic implemented in `overseer.ts` (Manual trigger required for now).");

    console.log("\n✅ PHASE 13 EXPORT VERIFIED");
}

run().catch(e => {
    console.error(e);
    process.exit(1);
});
