import { NextResponse } from "next/server";
import { UnauthorizedError } from "@/lib/auth/session";
import { EmployeesContextError } from "@/lib/employees/context";

export function handleEmployeesApiError(scope: string, error: unknown, unexpectedCode = "EMPLOYEES_UNEXPECTED_ERROR") {
  if (error instanceof EmployeesContextError) {
    return NextResponse.json(
      { code: "INVALID_EMPLOYEES_CONTEXT", message: error.message },
      { status: 400 },
    );
  }
  if (error instanceof UnauthorizedError) {
    return NextResponse.json({ code: "UNAUTHORIZED", message: error.message }, { status: error.status });
  }
  console.error(`EMPLOYEES_API_ERROR[${scope}]`, error);
  return NextResponse.json(
    { code: unexpectedCode, message: "Ocurrió un error inesperado en el módulo de empleados." },
    { status: 500 },
  );
}
