import { NextResponse } from "next/server";
import { UnauthorizedError } from "@/lib/auth/session";
import { BlueprintsContextError } from "@/lib/blueprints/repository";

export function handleBlueprintsApiError(
  scope: string,
  error: unknown,
  unexpectedCode = "BLUEPRINTS_UNEXPECTED_ERROR",
) {
  if (error instanceof BlueprintsContextError) {
    return NextResponse.json(
      { code: "INVALID_BLUEPRINTS_CONTEXT", message: error.message },
      { status: 400 },
    );
  }
  if (error instanceof UnauthorizedError) {
    return NextResponse.json({ code: "UNAUTHORIZED", message: error.message }, { status: error.status });
  }
  console.error(`BLUEPRINTS_API_ERROR[${scope}]`, error);
  return NextResponse.json(
    { code: unexpectedCode, message: "Ocurrió un error inesperado en el módulo de blueprints." },
    { status: 500 },
  );
}
