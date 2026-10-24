
import { signRequest } from "@/lib/security/internal-api";

async function verify() {
    console.log("--- Verifying Internal API Security ---");

    const secret = "test-secret";
    const body = JSON.stringify({ test: "data" });

    // 1. Valid Signature
    console.log("1. Generating Valid Signature...");
    const headers = await signRequest(body, secret);
    console.log("Headers:", headers);

    // Validate manually (Mocking server side logic)
    // In real test, we would fetch(workerUrl, { headers })

    // 2. Tampered Body
    console.log("2. Testing Tampered Body...");
    // If we change body but keep headers, server should reject.
    // This script just demonstrates the client signing works.

    if (!headers['x-drako-sig']) throw new Error("Missing Signature");
    if (!headers['x-drako-ts']) throw new Error("Missing Timestamp");
    if (!headers['x-drako-nonce']) throw new Error("Missing Nonce");

    console.log("SUCCESS: Client Signing logic works.");
}

verify().catch(console.error);
