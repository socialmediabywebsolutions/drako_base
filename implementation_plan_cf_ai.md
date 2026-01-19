# Implementación: Cerebro Cloudflare AI para SaaS Factory

**Objetivo:** Reemplazar el chat simulado (regex) con Llama 3 corriendo en Cloudflare Workers AI.
**Visión:** Campamento Base como orquestador inteligente nativo de Cloudflare.

## User Review Required
> [!IMPORTANT]
> **Requisito de Binding AI**:
> Para que esto funcione en producción (Cloudflare Pages), el proyecto debe tener el binding `AI` habilitado.
> En local (`wrangler pages dev`), funcionará si tienes sesión iniciada (`npx wrangler login`) y acceso a Workers AI.

## Proposed Changes

### Backend (Conversión natural a JSON)
#### [MODIFY] [route.ts](file:///c:/CAMPAMENTO%20BASE%20DRAKO/drako_base/src/app/api/campamento-base/saas-factory/chat/route.ts)
- Eliminar toda la lógica de regex (`VERTICAL_RULES`, `applyTierUpdates`, etc.).
- Importar `runAi` desde `src/lib/ai/client.ts`.
- Construir un **System Prompt** potente que incluya:
    - Definición de tipos de Packs (Marketing, Support, etc.).
    - Instrucción para devolver **siempre** un JSON estructurado con la update del blueprint y la respuesta al usuario.
- Usar Llama 3 (`@cf/meta/llama-3.1-70b-instruct`) para procesar el input del usuario y generar los cambios.

### AI Client
#### [MODIFY] [client.ts](file:///c:/CAMPAMENTO%20BASE%20DRAKO/drako_base/src/lib/ai/client.ts)
- Asegurar que el modelo `MODEL_SMART` apunte a Llama 3.1 70B (o la versión más estable disponible en CF).
- Verificar manejo de errores si el binding falla.

## Verification Plan

### Manual Verification
1.  **Chat Test**:
    - Input: *"Quiero una academia de inglés online, cobra 30€/mes, con marketing a tope y soporte básico."*
    - Esperado: El blueprint se actualiza solo (Vertical: EDUCATION, Price: 30, Marketing: FULL, Support: BASIC) y el chat responde confirmando.
2.  **Context Test**:
    - Input: *"Mejor sube el precio a 50€."*
    - Esperado: El chat recuerda que es una academia y solo actualiza el precio.

### Automated Tests
- No aplicable fácilmente sin mocks de AI, se priorizará testing manual en el shell interactivo.
