export const dynamic = "force-dynamic";

import { NextResponse } from "next/server";
import { requireOwnerAccess, UnauthorizedError } from "@/lib/auth/session";
import { getCloudflareEnv } from "@/lib/cloudflare/context";


export async function GET(request: Request) {
    try {
        const { tenantId } = await requireOwnerAccess(request);

        // In this system, the "owner" is often the tenant admin. 
        // We assume the owner record shares the ID with the tenant or user, 
        // but for now let's query by the owner_id associated with the session.
        // The previous migration 0010 defines 'owners' table.

        const db = getCloudflareEnv().DB;
        if (!db) {
            return NextResponse.json({ error: "Database unavailable" }, { status: 503 });
        }

        // We try to find the owner. Ideally 'user.id' or 'tenantId' maps to owner.
        // Let's assume tenantId is the owner context for Campamento Base.
        const owner = await db.prepare("SELECT * FROM owners WHERE id = ?").bind(tenantId).first();

        if (!owner) {
            // If no owner found, return null or empty structure so UI can prompt creation
            return NextResponse.json({ profile: null });
        }

        return NextResponse.json({ profile: owner });

    } catch (error) {
        if (error instanceof UnauthorizedError) {
            return NextResponse.json({ message: "Unauthorized" }, { status: 401 });
        }
        console.error("OWNER_PROFILE_GET_ERROR", error);
        return NextResponse.json({ message: "Internal Error" }, { status: 500 });
    }
}

export async function POST(request: Request) {
    try {
        const { tenantId } = await requireOwnerAccess(request);
        const body = await request.json() as any;
        const { name, nif, address, email, phone, country, city } = body;

        const db = getCloudflareEnv().DB;
        if (!db) {
            return NextResponse.json({ error: "Database unavailable" }, { status: 503 });
        }

        // Upsert logic
        await db.prepare(`
      INSERT INTO owners (id, name, nif, address, email, phone, country, city)
      VALUES (?, ?, ?, ?, ?, ?, ?, ?)
      ON CONFLICT(id) DO UPDATE SET
        name = excluded.name,
        nif = excluded.nif,
        address = excluded.address,
        email = excluded.email,
        phone = excluded.phone,
        country = excluded.country,
        city = excluded.city
    `).bind(tenantId, name, nif, address, email, phone, country, city).run();

        return NextResponse.json({ success: true });

    } catch (error) {
        if (error instanceof UnauthorizedError) {
            return NextResponse.json({ message: "Unauthorized" }, { status: 401 });
        }
        console.error("OWNER_PROFILE_POST_ERROR", error);
        return NextResponse.json({ message: "Internal Error" }, { status: 500 });
    }
}
