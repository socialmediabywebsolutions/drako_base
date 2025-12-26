import { NextResponse } from "next/server";
import { UnauthorizedError } from "@/lib/auth/session";
import { EconomyContextError } from "@/lib/economy/repository";

export function handleEconomyApiError(scope: string, error: unknown, unexpectedCode = "ECONOMY_UNEXPECTED_ERROR") {
  if (error instanceof EconomyContextError) {
    return NextResponse.json({ code: "INVALID_ECONOMY_CONTEXT", message: error.message }, { status: 400 });
  }
  if (error instanceof UnauthorizedError) {
    return NextResponse.json({ code: "UNAUTHORIZED", message: error.message }, { status: error.status });
  }
  console.error(`ECONOMY_API_ERROR[${scope}]`, error);
  return NextResponse.json(
    { code: unexpectedCode, message: "Ocurrió un error inesperado en el módulo económico." },
    { status: 500 },
  );
}
