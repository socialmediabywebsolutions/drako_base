export const dynamic = "force-dynamic";

import { NextResponse } from "next/server";

// Registro público deshabilitado — solo acceso por invitación o alta manual.
export async function POST() {
  return NextResponse.json({ error: "REGISTRATION_DISABLED" }, { status: 403 });
}
