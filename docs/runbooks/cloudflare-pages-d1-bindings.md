# Runbook: Cloudflare Pages D1 bindings (DRACO_DB)

Este runbook guía al owner para diagnosticar y solucionar el error de `DRACO_DB` "binding-missing" o `database_unavailable` al correr en Cloudflare Pages.

## ¿Qué significan los estados?
- `missing_binding`: el Worker no recibe la referencia a la base D1 porque el binding `DRACO_DB` no está configurado o no se ha asociado al entorno (Production/Preview). El código lanza `DatabaseUnavailableError` con `reason === "binding-missing"`.
- `database_unavailable`: estado ampliado que abarca `missing_binding` y otros fallos (migraciones inválidas, esquemas corruptos). El mensaje de la API insiste en que el fallback debe apuntar a `Settings → Bindings` cuando no encuentra `DRACO_DB`.

Si `/api/health` devuelve `db.status: "missing_binding"` o `/api/diag` `db.status: "unavailable"` con `bindingName: "DRACO_DB"`, el payload incluye este `action`:
`"Configure D1 binding in Cloudflare Pages: Project → Settings → Functions → D1 bindings."` Esa es la ruta oficial para restaurar el binding.

## Production vs Preview en Pages
- **Producción (branch `main` o la rama configurada como default).** Usa la base D1 `drako_db_prod`. Tiene su propia sección de binding en Pages y solo se activa cuando se despliega a la rama principal.
- **Preview (deploys temporales por PRs/branch).** Usa `drako_db`. El binding `DRACO_DB` debe repetirse en el entorno preview para evitar que `/pages.dev` o el dominio de preview fallen.
- Ambos entornos comparten el mismo nombre de variable (`DRACO_DB`) pero apuntan a bases distintas y se gestionan desde la pestaña de **Bindings**. Cada cambio de binding exige un redeploy en el entorno afectado para que `_worker.js` reciba el objeto `bindings`.
- El campo `bindings.dracoDb` que devuelve `/api/health` refleja si el binding se pasó correctamente (true/false), y `build.pages.commitSha` demuestra qué build está activo.

## Pasos exactos en el Dashboard
1. Abrir **Cloudflare dashboard** → **Workers & Pages** → entrar en el proyecto `drako-base-3` (o el nombre configurado).
2. Ir a **Settings** → **Functions** → **D1 bindings**.
3. Para cada entorno (use el selector de ambiente si aplica) añadir/confirmar:
   - Pulsar **Add Binding** → elegir **D1** como tipo.
   - Nombre del binding: `DRACO_DB`
   - Producción → Base D1: `drako_db_prod`
   - Preview → Base D1: `drako_db`
   - Guardar y repetir el proceso para el otro entorno si no estaba listo.
4. **IMPORTANTE:** Después de guardar, disparar un redeploy usando `npm run pages:build` + `npx wrangler pages deploy ...` o el botón de redeploy desde la pestaña de Releases. El binding solo se aplica cuando se reconstruye el worker.

## Cómo verificar
1. **Verificar bindings activos (prod + preview):**
   - Production: `curl -s https://drako-base.pages.dev/api/health` (ajustar al dominio oficial si es otro).
   - Preview: visitar el dominio de preview disponible en la lista de deploys de Pages (ej. `https://<project>.<random>.pages.dev/api/health`).
   - Comprobar que la respuesta JSON incluye `"bindings": { "dracoDb": true }`.
2. **Confirmar el commit activo:**
   - En la misma respuesta `/api/health`, revisar `build.pages.commitSha` (y `build.pages.branch` si necesita correlación con la rama).
   - Comparar ese SHA con el commit esperado de la release o de la rama que se desplegó.
3. **Revisar la acción recomendada:**
   - Si hay error, `/api/health` y `/api/diag` devuelven `action: "Configure D1 binding in Cloudflare Pages: Project → Settings → Functions → D1 bindings."`.
   - Ejecuta `curl -s <url>/api/diag` en el entorno afectado para confirmar que el campo `action` apunta exactamente a esa ruta. Esa frase es la guía oficial para volver a la pestaña de **Settings → Bindings** y evitar buscarla en otra parte.
4. **Chequeo final:**
   - Después de redeploy, `/api/health` debe regresar `ok: true`, `db.status: "ok"` y `bindings.dracoDb: true`.
   - `/api/diag` debe responder 200 sin `db` en `status: "unavailable"`.

Si la verificación falla en preview pero no en producción, repite los pasos de binding + redeploy para ese entorno. Si la falla persiste, revisar migraciones (`wrangler d1 migrations list …`) y asegurar que el binding puntual apunte a la base correcta.
