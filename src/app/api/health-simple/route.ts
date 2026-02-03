/**
 * OLIMPO: Simple Health Check Endpoint
 * 
 * NO database dependencies
 * NO AI dependencies
 * NO Cloudflare-specific code
 * Works in ALL environments (Vercel, Cloudflare, Development)
 */

import { NextResponse } from "next/server";
import { getEnvironmentName, getRuntimeName } from "@/lib/runtime";

export async function GET() {
    const environment = getEnvironmentName();
    const runtime = getRuntimeName();
    const timestamp = new Date().toISOString();

    return NextResponse.json(
        {
            ok: true,
            name: "DRAKO",
            environment,
            runtime,
            timestamp,
            version: "1.0.0",
        },
        {
            status: 200,
            headers: {
                "Cache-Control": "no-store, no-cache, must-revalidate",
                "Content-Type": "application/json",
            },
        }
    );
}
