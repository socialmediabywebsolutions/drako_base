-- Conexión de Facebook con varias Páginas: el callback de Meta guarda aquí la lista de
-- Páginas del usuario (con su token de Página cifrado) y redirige a
-- /socialflow/redes/facebook/select-page, donde el usuario elige cuál conectar. Antes se
-- conectaba siempre pages[0] sin preguntar. Filas de un solo uso, caducan a los 15 min
-- (expires_at) y se borran al completar la selección. Ver src/lib/socialflow/meta/pending-pages.ts.
CREATE TABLE IF NOT EXISTS socialflow_meta_pending_page_selections (
  id          TEXT PRIMARY KEY,
  tenant_id   TEXT NOT NULL,
  saas_id     TEXT NOT NULL,
  redirect_to TEXT,
  token_type  TEXT,
  expires_in  INTEGER,
  pages_json  TEXT NOT NULL,
  created_at  TEXT NOT NULL,
  expires_at  TEXT NOT NULL
);

CREATE INDEX IF NOT EXISTS idx_sf_meta_pending_pages_tenant ON socialflow_meta_pending_page_selections (tenant_id, expires_at);
