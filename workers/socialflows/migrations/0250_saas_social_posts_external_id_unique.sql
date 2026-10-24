-- Un mismo post de Instagram (external_post_id) no puede existir dos veces para un
-- tenant. Necesario para importar posts publicados fuera de la app (creation_mode
-- IMPORTED, ver src/lib/socialflow/meta/instagram-import.ts) sin duplicarlos al
-- reimportar ni chocar con los publicados desde Socialcors. Los NULL (posts aún no
-- publicados) no cuentan para la unicidad en SQLite. Comprobado antes de aplicar en
-- producción (2026-09-26): 200 filas con external_post_id, 200 pares distintos.
CREATE UNIQUE INDEX IF NOT EXISTS idx_saas_social_posts_tenant_external_unique
  ON saas_social_posts (tenant_id, external_post_id);
