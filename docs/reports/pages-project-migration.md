# Migración de Proyecto Cloudflare Pages (Si el panel está bloqueado)

## Resumen Ejecutivo
Si Cloudflare Pages insiste en buscar `.vercel/output/static` o ignora `wrangler.toml`, es porque el proyecto se creó con el preset "Next.js" (que asume Vercel build output) y el panel UI tiene precedencia sobre el archivo de configuración en algunos casos legacy.

**Solución**: Recrear el proyecto como "Custom" / "None".

## Pasos para Normalización Definitiva

1.  **Ir al Dashboard de Cloudflare Pages**.
2.  **Borrar (o renombrar)** el proyecto actual `drako-base-3`.
3.  **Crear Nuevo Proyecto**:
    *   **Connect to Git**: Seleccionar el repo `drako_base`.
    *   **Project Name**: `drako-base-3` (o el que se desee).
    *   **Production Branch**: `main`.
4.  **Build Settings (CRÍTICO)**:
    *   **Framework Preset**: `None` (No seleccionar Next.js).
    *   **Build Command**: `npm run build:worker`
    *   **Build Output Directory**: `.open-next`
    *   **Environment Variables**:
        *   (Copiar las variables de producción existentes como `DRACO_DB`, keys, etc.)
5.  **Deploy**:
    *   Cloudflare leerá `wrangler.toml` y usará la configuración de compatibilidad (`nodejs_compat`).
    *   El script `finalize-worker.js` asegurará que el output en `.open-next` sea válido.

## Verificación

Una vez desplegado:
```bash
curl -I https://drako-base-3.pages.dev/api/health
# Debe retornar HTTP 200 OK
```

## Por qué esto arregla el problema
Al seleccionar "None", Cloudflare deja de intentar "ser inteligente" con frameworks que conoce y confía ciegamente en:
1.  Tu comando de build (`npm run build:worker`).
2.  Tu directorio de salida (`.open-next`).
3.  Tu `wrangler.toml` (para bindings y flags).

Esta es la forma "Platform-Native" y robusta de desplegar OpenNext.
