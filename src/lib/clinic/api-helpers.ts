import { NextResponse } from "next/server";
import { UnauthorizedError } from "@/lib/auth/session";
import { NoActiveClinicSubscriptionError } from "@/lib/clinic/context";

export function handleClinicApiError(scope: string, error: unknown) {
  if (error instanceof NoActiveClinicSubscriptionError) {
    return NextResponse.json(
      {
        code: "NO_ACTIVE_CLINIC_SUBSCRIPTION",
        message: "Necesitas activar Drako Clinic para acceder a este módulo.",
      },
      { status: 403 },
    );
  }
  if (error instanceof UnauthorizedError) {
    return NextResponse.json({ code: "UNAUTHORIZED", message: error.message }, { status: error.status });
  }
  console.error(`CLINIC_API_ERROR[${scope}]`, error);
  return NextResponse.json(
    { code: "CLINIC_UNEXPECTED_ERROR", message: "Ocurrió un error inesperado en Drako Clinic." },
    { status: 500 },
  );
}
