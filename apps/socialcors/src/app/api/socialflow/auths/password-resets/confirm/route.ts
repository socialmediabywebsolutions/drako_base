export const dynamic = "force-dynamic";

import { NextResponse } from "next/server";
import { resolveAuthsDbForContext } from "@/lib/auths/repositories";
import { hashPassword } from "@/lib/auth/crypto";

async function sha256Hex(value: string): Promise<string> {
  const hash = await crypto.subtle.digest("SHA-256", new TextEncoder().encode(value));
  return Array.from(new Uint8Array(hash))
    .map((b) => b.toString(16).padStart(2, "0"))
    .join("");
}

export async function POST(req: Request) {
  let body: { token?: string; password?: string };
  try {
    body = await req.json();
  } catch {
    return NextResponse.json({ error: "INVALID_JSON" }, { status: 400 });
  }

  const rawToken = body.token?.trim() ?? "";
  const password = body.password ?? "";

  if (!rawToken) {
    return NextResponse.json({ error: "TOKEN_REQUIRED" }, { status: 400 });
  }
  if (password.length < 8) {
    return NextResponse.json(
      { error: "PASSWORD_TOO_SHORT", message: "La contraseña debe tener al menos 8 caracteres." },
      { status: 400 },
    );
  }

  const db = resolveAuthsDbForContext("socialflow");
  if (!db) {
    return NextResponse.json({ error: "SERVICE_UNAVAILABLE" }, { status: 503 });
  }

  const tokenHash = await sha256Hex(rawToken);
  const now = new Date().toISOString();

  type TokenRow = { id: string; user_id: string; expires_at: string; used_at: string | null };
  const tokenRow = await db
    .prepare(
      `SELECT id, user_id, expires_at, used_at
       FROM socialflow_password_reset_tokens
       WHERE token_hash = ?
       LIMIT 1`,
    )
    .bind(tokenHash)
    .first<TokenRow>();

  if (!tokenRow || tokenRow.used_at !== null || tokenRow.expires_at < now) {
    return NextResponse.json(
      { error: "INVALID_OR_EXPIRED_TOKEN", message: "El enlace es inválido o ha expirado. Solicita uno nuevo." },
      { status: 400 },
    );
  }

  // Mark token as used before updating the password (prevents race conditions).
  const markRaw = await db
    .prepare(
      `UPDATE socialflow_password_reset_tokens
       SET used_at = ?
       WHERE id = ? AND used_at IS NULL`,
    )
    .bind(now, tokenRow.id)
    .run();
  const markResult = markRaw?.meta as { changes?: number } | undefined;

  if (!markResult?.changes) {
    // Another request consumed the token first.
    return NextResponse.json(
      { error: "INVALID_OR_EXPIRED_TOKEN", message: "El enlace ya fue utilizado. Solicita uno nuevo." },
      { status: 400 },
    );
  }

  const { hash, salt, iterations } = await hashPassword(password);

  await db
    .prepare(
      `UPDATE socialflow_credentials
       SET hash = ?, salt = ?, iterations = ?, updated_at = ?
       WHERE user_id = ? AND type = 'password'`,
    )
    .bind(hash, salt, iterations, new Date().toISOString(), tokenRow.user_id)
    .run();

  return NextResponse.json({ ok: true });
}
