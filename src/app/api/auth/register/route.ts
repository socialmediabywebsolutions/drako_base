export const dynamic = "force-dynamic";

import { NextResponse } from "next/server";

export async function POST(req: Request) {
    try {
        const body = await req.json();

        // Steel Security: Forward to Internal Worker with Secret
        // This keeps the INTERNAL_API_SECRET server-side.
        const internalRes = await fetch("https://drako.systems/internal/auth/register", {
            method: "POST",
            headers: {
                "Content-Type": "application/json",
                // Steel V1.0.1: Use specific secret for Vercel->Worker comms
                "X-Drako-Origin-Secret": process.env.VERCEL_TO_WORKER_SECRET || "",
            },
            body: JSON.stringify(body),
        });

        const data = await internalRes.json() as { error?: string, [key: string]: any };

        if (!internalRes.ok) {
            return NextResponse.json(
                { error: data.error || "Registration failed" },
                { status: internalRes.status }
            );
        }

        return NextResponse.json(data, { status: 201 });
    } catch (error: any) {
        console.error("PROXY_REGISTER_ERROR", error);
        return NextResponse.json(
            { error: "Internal Server Error" },
            { status: 500 }
        );
    }
}
