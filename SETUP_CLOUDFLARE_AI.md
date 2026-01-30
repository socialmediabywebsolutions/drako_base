# 🧠 Cómo activar la Inteligencia Real de Drako (Cloudflare AI)

Actualmente, Drako está funcionando en **Modo Simulación (Mock)**. Esto significa que usa respuestas preprogramadas para desarrollo local rápido y gratuito.

Para activar la verdadera IA (LLama 3.1 70B) y que Drako entienda contextos complejos, responda "tengo gases" con humor pero profesionalidad, y genere blueprints reales, necesitas configurar **Cloudflare AI**.

## Paso 1: Obtener Credenciales de Cloudflare

1.  Crea una cuenta gratuita en [Cloudflare](https://dash.cloudflare.com/sign-up).
2.  En el dashboard, ve a **AI** > **AI Gateway** en el menú de la izquierda.
3.  Haz clic en **Create Gateway**.
    *   Nombre: `drako-gateway` (o lo que quieras)
    *   Slug: `drako-gateway`
4.  Una vez creado, verás un botón **API** arriba a la derecha. Haz clic.
5.  Necesitas copiar dos valores:
    *   **Account ID**: (Está en la URL o en la barra lateral derecha del dashboard principal).
    *   **Gateway ID**: El nombre que le diste al gateway (ej: `drako-gateway`).

## Paso 2: Configurar Drako Base

1.  Abre el archivo `.dev.vars` en la raíz del proyecto.
2.  Añade o edita las siguientes líneas con tus credenciales:

```ini
# .dev.vars
CF_ACCOUNT_ID="tu_account_id_aqui"
AI_GATEWAY_ID="drako-gateway"
```

> **Nota:** No necesitas una API Token si usas `wrangler dev` logueado, pero para asegurar la conexión local, a veces es útil crear un Token de API con permisos de "Workers AI Read". Si tienes problemas, añade `AI_GATEWAY_TOKEN="tu_token"` también.

## Paso 3: Reiniciar el Servidor

1.  Detén el servidor actual (`Ctrl + C` en la terminal).
2.  Ejecuta de nuevo:
    ```bash
    npm run dev
    ```

## ¿Cómo sé si funciona?

Cuando la IA real esté activa, verás en la consola del terminal logs que dicen `AI_COMPAT_CALL` o `AI_BINDING_CALL` con uso de tokens reales.

Además, Drako dejará de seguir el guion fijo y responderá de forma dinámica a cualquier cosa que le digas.

---

**Troubleshooting:**
Si ves errores de `401 Unauthorized` o `403 Forbidden` en la terminal, asegúrate de haber ejecutado `npx wrangler login` para autenticar tu entorno local con Cloudflare.
