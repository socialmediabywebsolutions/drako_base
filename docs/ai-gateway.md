# Cloudflare AI Gateway + Workers AI (Drako Base)

Objetivo: toda llamada a IA pasa por el backend (Pages Function/Worker) y por AI Gateway, con metadata multi-tenant.

## Endpoints internos
- `POST /api/ai/chat`
  - Body: `{ messages: [{role, content}], agentId?, department?, tenantId?, saasId?, plan?, mode: "fast"|"smart", cache?: boolean }`
  - Model mapping:
    - `fast`  → `@cf/meta/llama-3.2-3b-instruct`
    - `smart` → `@cf/meta/llama-3.1-70b-instruct`
  - Respuesta: `{ ok: true, content, model, provider, usage? }`
  - Metadata Gateway: header `cf-aig-metadata` con `{tenantId, saasId, agentId, department, plan, mode}`.

## Cliente de IA (server-only)
- Archivo: `src/lib/ai/client.ts`
- Modos:
  1) **Binding** (`env.AI.run`): usa gateway id y cacheTtl/skipCache (más rápido y autenticado).
  2) **Compat OpenAI**: `POST https://gateway.ai.cloudflare.com/v1/{ACCOUNT}/{GATEWAY}/compat/chat/completions` con `model: workers-ai/{modelId}`.
- Siempre desde backend; el frontend nunca llama directo.

## Variables de entorno (Pages/Workers)
- `AI_GATEWAY_ID` (obligatorio)
- `CF_ACCOUNT_ID` (obligatorio para compat)
- `AI_GATEWAY_COMPAT_TOKEN` (opcional si gateway requiere auth; usar secret)
- `AI` (binding Workers AI) configurado en Pages Functions (opcional pero recomendado)
- Otras ya existentes (D1, etc.) no se tocan.

## Seguridad
- Claves en secrets (no en cliente). Si se usa gateway autenticado, enviar `Authorization: Bearer <AI_GATEWAY_COMPAT_TOKEN>` desde el server.
- Frontend siempre llama al endpoint interno `/api/ai/chat`.

## Observabilidad
- Logs: `AI_BINDING_CALL` / `AI_COMPAT_CALL` con proveedor, modelo, tenantId, agentId, duración, cache.
- Errores: `AI_COMPAT_ERROR` con status/text.
- Extensible: añadir métricas/tokens por tenant/agente en el futuro.

## Caching / Rate limiting
- `cache: true` en la petición habilita `cacheTtl` (300s) en binding; compat usa el gateway (configurar reglas allí).
- Rate limits adicionales pueden aplicarse en Worker middleware (no implementado aquí).

## Cómo cambiar modelos
- Actualizar constantes en `src/lib/ai/client.ts`:
  - `MODEL_FAST`
  - `MODEL_SMART`
- Para proveedores futuros: usar compat endpoint con `model: <provider>/<model>`; no requiere reescribir el frontend, solo lógica de selección en el cliente.
