/**
 * P1 PRODUCT REAL: Students Endpoint
 * 
 * GET /api/students/:id - Obtiene estudiante
 * POST /api/students - Crea estudiante
 */

import { NextRequest, NextResponse } from "next/server";
import { MentoriaFamilyRepository } from "@/lib/mentoria/family-repository";

export const dynamic = "force-dynamic";

export async function GET(request: NextRequest) {
  try {
    const { searchParams } = new URL(request.url);
    const studentId = searchParams.get("id");

    if (!studentId) {
      return NextResponse.json(
        { error: "Missing studentId parameter" },
        { status: 400 }
      );
    }

    const repo = new MentoriaFamilyRepository();
    const student = await repo.getStudentById(studentId);

    if (!student) {
      return NextResponse.json(
        { error: "Student not found" },
        { status: 404 }
      );
    }

    return NextResponse.json({ student }, { status: 200 });
  } catch (error) {
    const message = error instanceof Error ? error.message : String(error);
    return NextResponse.json({ error: message }, { status: 500 });
  }
}

export async function POST(request: NextRequest) {
  try {
    const body = (await request.json()) as {
      familyId?: string;
      name?: string;
      age?: number;
      level?: string;
    };
    const { familyId, name, age, level } = body;

    if (!familyId || !name) {
      return NextResponse.json(
        { error: "Missing required fields: familyId, name" },
        { status: 400 }
      );
    }

    const repo = new MentoriaFamilyRepository();
    const student = await repo.createStudent({
      familyId,
      name,
      age,
      level,
    });

    return NextResponse.json({ student }, { status: 201 });
  } catch (error) {
    const message = error instanceof Error ? error.message : String(error);
    return NextResponse.json({ error: message }, { status: 500 });
  }
}
