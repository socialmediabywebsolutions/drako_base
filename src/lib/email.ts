import { env } from "@/lib/cf";

type SendEmailParams = {
  to: string;
  subject: string;
  html: string;
};

function resolveEmailConfig(): { apiKey: string; from: string } | null {
  const bindings = env() as Record<string, unknown> | null;
  const apiKey =
    (typeof bindings?.RESEND_API_KEY === "string" ? bindings.RESEND_API_KEY : null) ??
    (typeof process !== "undefined" ? process.env.RESEND_API_KEY : null);
  if (!apiKey) return null;
  const from =
    (typeof bindings?.RESEND_FROM_EMAIL === "string" ? bindings.RESEND_FROM_EMAIL : null) ??
    (typeof process !== "undefined" ? process.env.RESEND_FROM_EMAIL : null) ??
    "Socialcors <noreply@socialcors.com>";
  return { apiKey, from };
}

export async function sendEmail(
  params: SendEmailParams,
): Promise<{ ok: true } | { ok: false; code: string }> {
  const config = resolveEmailConfig();
  if (!config) {
    console.error("[Email] RESEND_API_KEY is not configured");
    return { ok: false, code: "EMAIL_NOT_CONFIGURED" };
  }

  try {
    const res = await fetch("https://api.resend.com/emails", {
      method: "POST",
      headers: {
        Authorization: `Bearer ${config.apiKey}`,
        "Content-Type": "application/json",
      },
      body: JSON.stringify({
        from: config.from,
        to: params.to,
        subject: params.subject,
        html: params.html,
      }),
    });

    if (!res.ok) {
      const body = await res.text().catch(() => "");
      console.error("[Email] Resend error", res.status, body);
      return { ok: false, code: "EMAIL_SEND_FAILED" };
    }

    return { ok: true };
  } catch (error) {
    console.error("[Email] Fetch failed", error instanceof Error ? error.message : String(error));
    return { ok: false, code: "EMAIL_SEND_FAILED" };
  }
}
