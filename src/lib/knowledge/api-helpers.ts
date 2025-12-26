import { NextResponse } from "next/server";
import { UnauthorizedError } from "@/lib/auth/session";
import { KnowledgeContextError } from "@/lib/knowledge/repository";

export function handleKnowledgeApiError(scope: string, error: unknown, unexpectedCode = "KNOWLEDGE_UNEXPECTED_ERROR") {
  if (error instanceof KnowledgeContextError) {
    return NextResponse.json(
      { code: "INVALID_KNOWLEDGE_CONTEXT", message: error.message },
      { status: 400 },
    );
  }
  if (error instanceof UnauthorizedError) {
    return NextResponse.json({ code: "UNAUTHORIZED", message: error.message }, { status: error.status });
  }
  console.error(`KNOWLEDGE_API_ERROR[${scope}]`, error);
  return NextResponse.json(
    { code: unexpectedCode, message: "Ocurrió un error inesperado en knowledge." },
    { status: 500 },
  );
}
