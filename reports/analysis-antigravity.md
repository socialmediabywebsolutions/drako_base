# Reporte de Análisis: Drako Base - SaaS Factory

**Fecha:** 2026-01-18
**Rama:** `antigravity-lab`
**Estado General:** El framework tiene una base muy sólida para la orquestación y el dashboarding, pero la "Inteligencia Artificial" del chat es actualmente un conjunto de reglas heurísticas (regex) y no un modelo de lenguaje real.

---

## 1. Estado de los Módulos

| Módulo | Estado | Ubicación Principal | Notas |
| :--- | :--- | :--- | :--- |
| **Factory / Orchestrator** | ✅ **Listo** | `src/lib/campamento-base/saas-factory-orchestrator.ts` | Cerebro central. Coordina DB, Stripe, Cloudflare y Agentes. Lógica robusta con soporte `dry-run` vs `live`. |
| **Agents** | ✅ **Listo** | `src/lib/campamento-base/agent-factory.ts` | Sistema de "Packs" (Basic, Standard, Full) definido en `campamento-base.ts`. |
| **Billing (Stripe)** | ✅ **Listo** | `src/lib/campamento-base/provisioning/stripe-factory.ts` | Maneja Productos y Precios dinámicamente. Verifica dominios antes de crear en Live. |
| **Cloudflare** | ✅ **Listo** | `src/lib/campamento-base/provisioning/cloudflare-factory.ts` | Gestión de DNS y Custom Hostnames vía API. |
| **Auth** | ⚠️ **Custom** | `src/lib/auth/session.ts` | No usa NextAuth/Clerk. Parece un sistema propio basado en cookies/headers (posiblemente integrado con CF Access). Requiere auditoría de seguridad. |
| **Dashboard** | ✅ **Listo** | `src/app/saas/[id]` | UI muy completa y rica. Múltiples secciones (Marketing, Ventas, Empleados, Métricas). |
| **AI Chat** | ❌ **Simulado** | `src/app/api/campamento-base/saas-factory/chat/route.ts` | **BLOQUEANTE**. Usa `regex` para detectar palabras clave ("peluqueria", "premium"). No hay LLM conectado. |

---

## 2. Qué falta para "Automático desde un Chat"

Para que CampamentoBase cree SaaS "de verdad" conversando, necesitamos reemplazar la lógica simulada actual.

### Faltantes P0 (Críticos):
1.  **Integración LLM Real**:
    -   El archivo `route.ts` del chat debe llamar a un modelo (OpenAI GPT-4o, Gemini 1.5 Pro, o DeepSeek) para interpretar la intención del usuario.
    -   Se necesita un **Prompt de Sistema** que reciba el JSON Schema de `SaasBlueprintDraft` y obligue al LLM a devolver un JSON estructurado basado en la conversación.
2.  **Persistencia del Contexto**:
    -   Actualmente el chat solo reacciona al último mensaje y actualiza el blueprint in-memory (en el cliente/respuesta). Se necesita mantener un hilo coherente si la conversación se alarga.

### Faltantes P1 (Mejoras):
1.  **Validación de Identidad**: Asegurar que quien chatea tiene permisos para provisionar recursos reales (especialmente Billing/Cloudflare).
2.  **Feedback Loop**: Que el LLM explique *por qué* tomó ciertas decisiones (ej: "Elegí el pack Marketing FULL porque mencionaste expansión agresiva").

---

## 3. Plan de Acción Recomendado (Roadmap)

### Fase 1: Cerebro AI Real (Antigravity Lab)
-   [ ] Crear `src/lib/ai/client.ts` para conectar con proveedor LLM.
-   [ ] Refactorizar `src/app/api/campamento-base/saas-factory/chat/route.ts` para usar el LLM.
-   [ ] Diseñar el System Prompt para "Extracción de Blueprint".

### Fase 2: Robustez
-   [ ] Verificar credenciales de entorno (`STRIPE_SECRET_KEY`, `CLOUDFLARE_API_TOKEN`) en la rama actual.
-   [ ] Probar el flujo `dry-run` completo creación de un SaaS "Peluquería de prueba".

---

## Conclusión
La infraestructura ("cuerpo") es excelente. Falta el "cerebro" (LLM) que entienda al usuario. El sistema actual es un "mago de oz" automático (heurística simple).
