import { NextResponse } from "next/server";
import { UnauthorizedError } from "@/lib/auth/session";
import { TasksContextError } from "@/lib/tasks/repository";

export function handleTasksApiError(scope: string, error: unknown, unexpectedCode = "TASKS_UNEXPECTED_ERROR") {
  if (error instanceof TasksContextError) {
    return NextResponse.json(
      { code: "INVALID_TASKS_CONTEXT", message: error.message },
      { status: 400 },
    );
  }
  if (error instanceof UnauthorizedError) {
    return NextResponse.json({ code: "UNAUTHORIZED", message: error.message }, { status: error.status });
  }
  console.error(`TASKS_API_ERROR[${scope}]`, error);
  return NextResponse.json(
    { code: unexpectedCode, message: "Ocurrió un error inesperado en tareas." },
    { status: 500 },
  );
}
