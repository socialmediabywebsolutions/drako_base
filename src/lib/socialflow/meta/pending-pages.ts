import { env } from "@/lib/cf";
import { decryptToken, encryptToken } from "@/lib/socialflow/token-encryption";
import type { MetaPage, MetaTokenResponse } from "@/lib/socialflow/meta/core";

// Selección de Página de Facebook cuando el usuario administra varias (ver migración
// 0251). Los tokens de Página se guardan cifrados en SOCIAL_DB, nunca en la sesión ni en
// la URL: solo viaja al navegador el id aleatorio de la selección y el id/nombre de cada
// Página.
const PENDING_SELECTION_TTL_MS = 15 * 60 * 1000;

type StoredPage = { id: string; name: string; encryptedToken: string };

export type PendingPageSelection = {
  id: string;
  tenantId: string;
  saasId: string;
  redirectTo: string | null;
  token: Pick<MetaTokenResponse, "token_type" | "expires_in">;
  pages: Array<{ id: string; name: string }>;
};

function requireSocialDb(): D1Database {
  const db = env()?.SOCIAL_DB;
  if (!db) throw new Error("SOCIAL_DB not configured");
  return db;
}

export async function savePendingPageSelection(input: {
  tenantId: string;
  saasId: string;
  redirectTo: string | null;
  token: MetaTokenResponse;
  pages: MetaPage[];
}): Promise<string> {
  const db = requireSocialDb();
  const id = crypto.randomUUID();
  const now = Date.now();
  const pages: StoredPage[] = [];
  for (const page of input.pages) {
    const encryptedToken = await encryptToken(page.access_token);
    if (!encryptedToken) throw new Error("META_PAGE_TOKEN_ENCRYPTION_FAILED");
    pages.push({ id: page.id, name: page.name, encryptedToken });
  }

  await db
    .prepare(
      `INSERT INTO socialflow_meta_pending_page_selections
         (id, tenant_id, saas_id, redirect_to, token_type, expires_in, pages_json, created_at, expires_at)
       VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?)`,
    )
    .bind(
      id,
      input.tenantId,
      input.saasId,
      input.redirectTo,
      input.token.token_type ?? null,
      input.token.expires_in ?? null,
      JSON.stringify(pages),
      new Date(now).toISOString(),
      new Date(now + PENDING_SELECTION_TTL_MS).toISOString(),
    )
    .run();

  // Limpieza oportunista de selecciones caducadas de cualquier tenant.
  await db
    .prepare(`DELETE FROM socialflow_meta_pending_page_selections WHERE expires_at < ?`)
    .bind(new Date(now).toISOString())
    .run()
    .catch(() => {});

  return id;
}

type PendingRow = {
  id: string;
  tenant_id: string;
  saas_id: string;
  redirect_to: string | null;
  token_type: string | null;
  expires_in: number | null;
  pages_json: string;
  expires_at: string;
};

async function loadPendingRow(id: string, tenantId: string): Promise<PendingRow | null> {
  const row = await requireSocialDb()
    .prepare(`SELECT * FROM socialflow_meta_pending_page_selections WHERE id = ? AND tenant_id = ? LIMIT 1`)
    .bind(id, tenantId)
    .first<PendingRow>();
  if (!row || row.expires_at < new Date().toISOString()) return null;
  return row;
}

function parseStoredPages(json: string): StoredPage[] {
  try {
    const parsed = JSON.parse(json) as unknown;
    return Array.isArray(parsed) ? (parsed as StoredPage[]) : [];
  } catch {
    return [];
  }
}

function toSelection(row: PendingRow): PendingPageSelection {
  return {
    id: row.id,
    tenantId: row.tenant_id,
    saasId: row.saas_id,
    redirectTo: row.redirect_to,
    token: { token_type: row.token_type ?? undefined, expires_in: row.expires_in ?? undefined },
    pages: parseStoredPages(row.pages_json).map((p) => ({ id: p.id, name: p.name })),
  };
}

// Lectura para la pantalla de selección — solo id y nombre de cada Página, sin tokens.
export async function getPendingPageSelection(id: string, tenantId: string): Promise<PendingPageSelection | null> {
  const row = await loadPendingRow(id, tenantId);
  return row ? toSelection(row) : null;
}

// Consume la selección: devuelve la Página elegida con su token descifrado y borra la
// fila (un solo uso). null si no existe, caducó, es de otro tenant o la Página no estaba
// en la lista.
export async function consumePendingPageSelection(
  id: string,
  tenantId: string,
  pageId: string,
): Promise<{ selection: PendingPageSelection; page: MetaPage } | null> {
  const row = await loadPendingRow(id, tenantId);
  if (!row) return null;
  const stored = parseStoredPages(row.pages_json).find((p) => p.id === pageId);
  if (!stored) return null;
  const accessToken = await decryptToken(stored.encryptedToken);
  if (!accessToken) return null;

  await requireSocialDb()
    .prepare(`DELETE FROM socialflow_meta_pending_page_selections WHERE id = ?`)
    .bind(id)
    .run();

  return { selection: toSelection(row), page: { id: stored.id, name: stored.name, access_token: accessToken } };
}
