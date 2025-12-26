import { NextResponse } from "next/server";
import { WhatsappContextError } from "@/lib/whatsapp/repository";

export function handleWhatsappApiError(error: unknown) {
  if (error instanceof WhatsappContextError) {
    return NextResponse.json({ code: "INVALID_CONTEXT", message: error.message }, { status: 400 });
  }
  console.error("WHATSAPP_API_ERROR", error);
  return NextResponse.json({ code: "WHATSAPP_UNEXPECTED_ERROR", message: "Unexpected WhatsApp error" }, { status: 500 });
}
