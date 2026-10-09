import { requireCurrentSocialFlowSession } from "@/lib/socialflow/auth/request";
import { listSaasSocialAccounts, resolveSocialContext, upsertSaasSocialAccount } from "@/lib/socialflow/repository";
import type { SaasSocialProvider } from "@/lib/social-core/types";

export const dynamic = "force-dynamic";

const DISCONNECTABLE_PROVIDERS: SaasSocialProvider[] = ["LINKEDIN", "FACEBOOK_PAGE", "INSTAGRAM"];

export async function POST(request: Request) {
  try {
    const session = await requireCurrentSocialFlowSession(request);
    const body = (await request.json().catch(() => null)) as { provider?: string; saasId?: string } | null;
    const provider = body?.provider;
    const saasId = body?.saasId?.trim() || "socialflow";

    if (!provider || !DISCONNECTABLE_PROVIDERS.includes(provider as SaasSocialProvider)) {
      return new Response(JSON.stringify({ error: "INVALID_PROVIDER" }), {
        status: 400,
        headers: { "content-type": "application/json" },
      });
    }

    const ctx = await resolveSocialContext({ tenantId: session.tenantId, saasId });
    const accounts = await listSaasSocialAccounts(ctx);
    const existing = accounts.find((account) => account.provider === provider);

    if (!existing) {
      return new Response(JSON.stringify({ ok: true, provider, status: "DISCONNECTED" }), {
        status: 200,
        headers: { "content-type": "application/json" },
      });
    }

    await upsertSaasSocialAccount(ctx, {
      id: existing.id,
      saasId: existing.saasId,
      provider: existing.provider,
      handle: existing.handle,
      displayName: existing.displayName,
      status: "DISCONNECTED",
      authMeta: {},
      isPrimary: existing.isPrimary,
    });

    // Log explícito de quién desconectó y desde dónde — para poder auditar
    // desconexiones que el tenant no recuerde haber pedido (ver investigación
    // del caso Sofía: no se encontró ningún trigger automático, solo este botón
    // manual y el webhook de meta/deauthorize; este log cubre el hueco si vuelve
    // a pasar).
    console.log("SOCIALFLOW_ACCOUNT_DISCONNECTED", {
      provider,
      accountId: existing.id,
      tenantId: session.tenantId,
      byUserEmail: session.email,
      byUserRole: session.role,
      ip: request.headers.get("cf-connecting-ip") ?? request.headers.get("x-forwarded-for") ?? null,
      userAgent: request.headers.get("user-agent"),
      source: "manual_disconnect_endpoint",
    });

    return new Response(JSON.stringify({ ok: true, provider, status: "DISCONNECTED" }), {
      status: 200,
      headers: { "content-type": "application/json" },
    });
  } catch (error) {
    if (error instanceof Error && error.message === "SESSION_REQUIRED") {
      return new Response(JSON.stringify({ error: "SESSION_REQUIRED" }), {
        status: 401,
        headers: { "content-type": "application/json" },
      });
    }

    console.error("SOCIALFLOW_ACCOUNTS_DISCONNECT_ERROR", error);
    return new Response(JSON.stringify({ error: "ACCOUNTS_DISCONNECT_FAILED" }), {
      status: 500,
      headers: { "content-type": "application/json" },
    });
  }
}
