import { NextResponse } from "next/server";
import { UnauthorizedError } from "@/lib/auth/session";
import { FeaturesContextError } from "@/lib/features/repository";

export function handleFeaturesApiError(scope: string, error: unknown, unexpectedCode = "FEATURES_UNEXPECTED_ERROR") {
  if (error instanceof FeaturesContextError) {
    return NextResponse.json({ code: "INVALID_FEATURES_CONTEXT", message: error.message }, { status: 400 });
  }
  if (error instanceof UnauthorizedError) {
    return NextResponse.json({ code: "UNAUTHORIZED", message: error.message }, { status: error.status });
  }
  console.error(`FEATURES_API_ERROR[${scope}]`, error);
  return NextResponse.json(
    { code: unexpectedCode, message: "Ocurrió un error inesperado en features." },
    { status: 500 },
  );
}
