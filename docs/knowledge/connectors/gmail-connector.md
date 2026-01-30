---
id: gmail-connector-spec
version: v1
scope: holding
status: active
owners: [drako-team]
tags: [gmail, conector, IA, oauth2, seguridad]
applies_to: [holding, saas-hijas]
---

# 📧 Conector Gmail para DKS

## Introducción
La integración de Gmail en DKS permite procesar correos reales del cliente. El conector de Gmail permite:
1. Autenticar mediante **OAuth2** y leer correos entrantes vía **Gmail API**.
2. **Clasificar automáticamente** los correos (factura, soporte, ventas, alerta, etc.) usando IA.
3. **Enrutar** cada correo al departamento o agente correspondiente según reglas de negocio.
4. Generar **respuestas automáticas** con LLM (opcional).

## Manifiesto Técnico y de Seguridad

### Autenticación
La API de Gmail requiere OAuth2. Cada usuario autoriza el acceso con su cuenta Google. El sistema almacena el token por tenant (no en `.env`). Se usan las librerías oficiales (`googleapis`) para manejo seguro.

### Consulta (Polling)
El agente `gmail-agent.ts` invoca periódicamente `gmail.users.messages.list` con filtros como `q: 'in:inbox is:unread'`. Obtiene el contenido completo para su procesamiento.

### Clasificación IA
Un agente IA analiza asunto y cuerpo asignando una etiqueta única: `Factura`, `Soporte`, `Ventas`, `Alerta` u `Otro`.

### Seguridad
- Tokens gestionados por tenant con rotación.
- Scopes mínimos (sólo lectura de Gmail).
- Logging detallado para auditoría.
- No se almacenan credenciales sensibles en el repo.

## Ejemplo de Agente: `gmail-agent.ts`

```typescript
import { google } from 'googleapis';
import { EmailRouter } from '../core/email-router';

export class GmailAgent {
  private gmail: any;

  constructor(oauthClient: any) {
    this.gmail = google.gmail({ version: 'v1', auth: oauthClient });
  }

  async pollInbox() {
    const res = await this.gmail.users.messages.list({
      userId: 'me',
      q: 'in:inbox is:unread',
    });
    const messages = res.data.messages || [];

    for (const msg of messages) {
      const fullMsg = await this.gmail.users.messages.get({
        userId: 'me',
        id: msg.id,
      });
      
      const headers = fullMsg.data.payload?.headers || [];
      const subject = headers.find(h => h.name === 'Subject')?.value || '';
      const body = this.extractBody(fullMsg.data.payload);

      await EmailRouter.routeEmail({ subject, body, raw: fullMsg.data });

      await this.gmail.users.messages.modify({
        userId: 'me',
        id: msg.id,
        resource: { removeLabelIds: ['UNREAD'] },
      });
    }
  }

  private extractBody(payload: any): string {
    if (payload.parts) {
      return payload.parts.map(part => part.body?.data || '').join('');
    }
    return payload.body?.data || '';
  }
}
```

## Prompt de Clasificación

```markdown
Eres un asistente de IA experto en clasificación de correos electrónicos. Te proporcionaré el asunto y el cuerpo de un mensaje, y debes devolver una única etiqueta apropiada entre: *Factura*, *Soporte*, *Ventas*, *Alerta*, *Otro*.

Reglas de clasificación:
- **Factura**: Términos relacionados con pagos o facturación.
- **Soporte**: Problemas o dudas del servicio.
- **Ventas**: Oportunidades comerciales o interesados nuevos.
- **Alerta**: Notificaciones críticas (errores, seguridad).
- **Otro**: Correos que no encajen en lo anterior.

Devuelve únicamente la etiqueta según las reglas anteriores.
```

---
*Drako Connector System — Gmail Intelligence Integration.*
