/**
 * P1 PRODUCT REAL: Families Endpoint
 * 
 * GET /api/families/:id - Obtiene familia
 * POST /api/families - Crea familia
 */

import { NextRequest, NextResponse } from "next/server";
import { MentoriaFamilyRepository } from "@/lib/mentoria/family-repository";
import { MentoriaFamilyService } from "@/lib/mentoria/family-service";
import { getMentoriaDb } from "@/lib/mentoria/get-mentoria-db";
import { env } from "@/lib/cf";

export const dynamic = "force-dynamic";

export async function GET(request: NextRequest) {
  try {
    const { searchParams } = new URL(request.url);
    const familyId = searchParams.get("id");

    if (!familyId) {
      return NextResponse.json(
        { error: "Missing familyId parameter" },
        { status: 400 }
      );
    }

    const db = getMentoriaDb(env?.());
    const repo = new MentoriaFamilyRepository(db);
    const family = await repo.getFamilyById(familyId);

    if (!family) {
      return NextResponse.json(
        { error: "Family not found" },
        { status: 404 }
      );
    }

    return NextResponse.json({ family }, { status: 200 });
  } catch (error) {
    const message = error instanceof Error ? error.message : String(error);
    return NextResponse.json({ error: message }, { status: 500 });
  }
}

export async function POST(request: NextRequest) {
  try {
    const body = (await request.json()) as { familyId?: string };
    const { familyId } = body;

    if (!familyId) {
      return NextResponse.json(
        { error: "Missing familyId" },
        { status: 400 }
      );
    }

    const db = getMentoriaDb(env?.());
    const repo = new MentoriaFamilyRepository(db);
    const family = await repo.createFamily(familyId);

    return NextResponse.json({ family }, { status: 201 });
  } catch (error) {
    const message = error instanceof Error ? error.message : String(error);
    return NextResponse.json({ error: message }, { status: 500 });
  }
}
