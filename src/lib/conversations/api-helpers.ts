import { NextResponse } from "next/server";
import { ConversationsContextError, ConversationAccessError, ConversationNotFoundError } from "@/lib/conversations/repository";

export function handleConversationsApiError(error: unknown) {
  if (error instanceof ConversationsContextError) {
    return NextResponse.json({ code: "INVALID_CONTEXT", message: error.message }, { status: 400 });
  }
  if (error instanceof ConversationNotFoundError) {
    return NextResponse.json({ code: "NOT_FOUND", message: error.message }, { status: 404 });
  }
  if (error instanceof ConversationAccessError) {
    return NextResponse.json({ code: "NOT_FOUND", message: error.message }, { status: 404 });
  }
  console.error("CONVERSATIONS_API_ERROR", error);
  return NextResponse.json(
    { code: "CONVERSATIONS_UNEXPECTED_ERROR", message: "Unexpected conversations error" },
    { status: 500 },
  );
}
