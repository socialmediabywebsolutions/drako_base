import { NextResponse } from "next/server";
import { queryAll } from "@/lib/db";

export const runtime = "edge";

type Department = { id: string; name: string; description: string | null };

export async function GET() {
  const items = await queryAll<Department>(
    "SELECT id, name, description FROM departments ORDER BY name ASC"
  );
  return NextResponse.json({ items, count: items.length });
}
