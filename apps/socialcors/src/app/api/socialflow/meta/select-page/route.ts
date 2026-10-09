import { NextResponse } from "next/server";
import { requireCurrentSocialFlowSession } from "@/lib/socialflow/auth/request";
import { MetaIntegrationError } from "@/lib/socialflow/meta/core";
import { connectSocialFlowMetaPage } from "@/lib/socialflow/meta/oauth";
import { consumePendingPageSelection } from "@/lib/socialflow/meta/pending-pages";

export const dynamic = "force-dynamic";

const FALLBACK_REDIRECT = "/socialflow/redes";

function redirectWith(request: Request, path: string, params: Record<string, string | null | undefined>) {
  const url = new URL(path, request.url);
  for (const [key, value] of Object.entries(params)) {
    if (value) url.searchParams.set(key, value);
  }
  // 303: el formulario de selección llega por POST y el destino debe cargarse con GET.
  return NextResponse.redirect(url, 303);
}

// Paso final de la conexión de Facebook con varias Páginas: recibe el formulario de
// /socialflow/redes/facebook/select-page (pending + pageId), consume la selección
// pendiente del tenant de la sesión y conecta la Página elegida igual que el callback de
// Meta cuando solo hay una.
export async function POST(request: Request) {
  let session: Awaited<ReturnType<typeof requireCurrentSocialFlowSession>>;
  try {
    session = await requireCurrentSocialFlowSession(request);
  } catch {
    return redirectWith(request, "/socialflow/auth", {});
  }

  const form = await request.formData().catch(() => null);
  const pendingId = String(form?.get("pending") ?? "").trim();
  const pageId = String(form?.get("pageId") ?? "").trim();
  if (!pendingId || !pageId) {
    return redirectWith(request, FALLBACK_REDIRECT, { meta: "error", provider: "meta", code: "META_PAGE_SELECTION_INVALID" });
  }

  const consumed = await consumePendingPageSelection(pendingId, session.tenantId, pageId).catch(() => null);
  if (!consumed) {
    return redirectWith(request, FALLBACK_REDIRECT, {
      meta: "error",
      provider: "meta",
      code: "META_PAGE_SELECTION_EXPIRED",
      message: "La selección de Página caducó o no es válida. Vuelve a conectar Facebook.",
    });
  }

  const { selection, page } = consumed;
  const redirectTo = selection.redirectTo || FALLBACK_REDIRECT;
  try {
    const { persistence } = await connectSocialFlowMetaPage({
      tenantId: selection.tenantId,
      saasId: selection.saasId,
      token: { access_token: "", token_type: selection.token.token_type, expires_in: selection.token.expires_in },
      page,
    });
    return redirectWith(request, redirectTo, {
      meta: persistence.status === "failed" ? "warning" : "connected",
      provider: "meta",
      status: persistence.status,
      saasId: selection.saasId,
      accountIds: "accountIds" in persistence ? persistence.accountIds.join(",") : null,
    });
  } catch (error) {
    const code = error instanceof MetaIntegrationError ? error.code : "META_PAGE_CONNECT_FAILED";
    const message = error instanceof Error ? error.message : "No se pudo conectar la Página de Facebook.";
    console.error("SOCIALFLOW_META_SELECT_PAGE_ERROR", code, message);
    return redirectWith(request, redirectTo, { meta: "error", provider: "meta", code, message, saasId: selection.saasId });
  }
}
