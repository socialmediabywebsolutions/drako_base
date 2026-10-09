export const dynamic = "force-dynamic";

import { NextResponse } from "next/server";
import { resolveSocialFlowAuthsDb } from "@/lib/socialflow/platform/auth/repository";
import { sendEmail } from "@/lib/socialflow/platform/email";

const TOKEN_TTL_MS = 60 * 60 * 1000; // 1 hour
const SOCIALFLOW_ORIGIN =
  process.env.SOCIALFLOW_SSO_ORIGIN ?? "https://socialflows.drako.systems";

async function sha256Hex(value: string): Promise<string> {
  const hash = await crypto.subtle.digest("SHA-256", new TextEncoder().encode(value));
  return Array.from(new Uint8Array(hash))
    .map((b) => b.toString(16).padStart(2, "0"))
    .join("");
}

function resetEmailHtml(resetUrl: string): string {
  return `<!DOCTYPE html>
<html>
<body style="margin:0;padding:0;background:#f5f7f2;font-family:sans-serif;">
  <table width="100%" cellpadding="0" cellspacing="0">
    <tr><td align="center" style="padding:40px 16px;">
      <table width="480" cellpadding="0" cellspacing="0" style="background:#fffdf7;border:1px solid #d8decd;border-radius:8px;padding:40px;">
        <tr><td>
          <p style="margin:0 0 4px;font-size:11px;font-weight:700;letter-spacing:0.2em;text-transform:uppercase;color:#75806f;">Socialcors</p>
          <h2 style="margin:0 0 20px;font-size:22px;color:#153b39;font-weight:700;">Reset your password</h2>
          <p style="margin:0 0 28px;font-size:15px;line-height:1.6;color:#374151;">
            We received a request to reset the password for your Socialcors account.
            Click the button below to choose a new one. This link is valid for <strong>1 hour</strong>.
          </p>
          <a href="${resetUrl}"
             style="display:inline-block;background:#153b39;color:#ffffff;padding:14px 28px;border-radius:6px;text-decoration:none;font-size:14px;font-weight:700;letter-spacing:0.05em;">
            Reset password
          </a>
          <p style="margin:28px 0 0;font-size:13px;color:#6b7280;">
            If you didn&apos;t request this, you can safely ignore this email — your password won&apos;t change.
          </p>
          <p style="margin:16px 0 0;font-size:11px;color:#9ca3af;word-break:break-all;">${resetUrl}</p>
        </td></tr>
      </table>
    </td></tr>
  </table>
</body>
</html>`;
}

export async function POST(req: Request) {
  let body: { email?: string };
  try {
    body = await req.json();
  } catch {
    return NextResponse.json({ error: "INVALID_JSON" }, { status: 400 });
  }

  const email = body.email?.trim().toLowerCase() ?? "";
  if (!email) {
    return NextResponse.json({ error: "EMAIL_REQUIRED" }, { status: 400 });
  }

  // Always respond with success to prevent email enumeration.
  const ok = NextResponse.json({ ok: true });

  const db = resolveSocialFlowAuthsDb();
  if (!db) return ok;

  type UserRow = { id: string; email: string; status: string };
  const user = await db
    .prepare(`SELECT id, email, status FROM socialflow_users WHERE email = ? LIMIT 1`)
    .bind(email)
    .first<UserRow>();

  if (!user || user.status !== "active") return ok;

  const rawToken = `${crypto.randomUUID()}${crypto.randomUUID()}`.replace(/-/g, "");
  const tokenHash = await sha256Hex(rawToken);
  const expiresAt = new Date(Date.now() + TOKEN_TTL_MS).toISOString();

  try {
    await db
      .prepare(
        `INSERT INTO socialflow_password_reset_tokens (id, user_id, token_hash, expires_at)
         VALUES (?, ?, ?, ?)`,
      )
      .bind(crypto.randomUUID(), user.id, tokenHash, expiresAt)
      .run();
  } catch (err) {
    console.error("[PasswordReset] Token insert failed", err instanceof Error ? err.message : String(err));
    return ok;
  }

  const resetUrl = `${SOCIALFLOW_ORIGIN}/socialflow/auth/reset-password?token=${rawToken}`;
  await sendEmail({
    to: user.email,
    subject: "Reset your Socialcors password",
    html: resetEmailHtml(resetUrl),
  });

  return ok;
}
