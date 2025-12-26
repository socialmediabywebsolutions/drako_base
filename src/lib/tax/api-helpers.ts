import { NextResponse } from "next/server";
import { TaxContextError } from "@/lib/tax/repository";

export function handleTaxApiError(error: unknown) {
  if (error instanceof TaxContextError) {
    return NextResponse.json({ code: "INVALID_CONTEXT", message: error.message }, { status: 400 });
  }
  console.error("TAX_API_ERROR", error);
  return NextResponse.json({ code: "TAX_UNEXPECTED_ERROR", message: "Unexpected tax error" }, { status: 500 });
}
