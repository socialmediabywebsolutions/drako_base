---
id: whatsapp-business-api
version: v1
scope: holding
status: active
owners: [drako-team]
tags: [whatsapp, meta, api, mensajería, chatbot, seguridad]
applies_to: [holding, saas-hijas]
---

# 📡 Conector WhatsApp Business API

## Descripción Técnica

El conector de WhatsApp Business API permite enviar y recibir mensajes entre el sistema Drako y usuarios de WhatsApp mediante la API oficial de Meta.

### Modos de Operación
- **Inbound (Entrantes)**: Mensajes iniciados por el usuario que llegan vía Webhooks (HTTPS + Verification Token).
- **Outbound (Salientes)**: Mensajes enviados mediante la Graph API de Meta usando tokens de acceso.

### Tipos de Mensajes
Soporta texto, multimedia (imágenes, audio, video, documentos, stickers), contactos, ubicaciones y mensajes interactivos (botones y listas).

### Gestión de Sesiones
- **Ventana de 24h**: Respuesta libre tras mensaje del usuario.
- **Plantillas (Templates)**: Obligatorias para mensajes iniciados por la empresa fuera de la ventana de 24h. Requieren aprobación previa de Meta.

## Infraestructura Recomendada
Se recomienda el uso de la **Cloud API** (gestionada por Meta) frente a la opción On-Premises para simplificar mantenimiento y reducir costos de hosting.

## Ejemplo de Agente IA (Entrantes)

```python
def handle_incoming_message(msg):
    # Extraer texto del webhook
    texto = msg["text_body"]  

    # Clasificar intención usando LLM
    categoria = llm.classify_intent(texto, prompt="Clasifica el mensaje entrante según el tema o urgencia.")

    if categoria == "soporte":
        route_to_support_agent(msg)
    elif categoria == "ventas":
        route_to_sales(msg)
    else:
        default_response(msg)
```

### Prompt del Agente
**Sistema**: Eres un asistente virtual especializado en atender clientes a través de WhatsApp para la empresa Drako. Clasifica el mensaje, empatiza y responde de forma clara y concisa en español.

## Implementación Funcional
El código base del agente se encuentra en:
- [agent.ts](file:///c:/CAMPAMENTO%20BASE%20DRAKO/drako_base/connectors/whatsapp/agent.ts) — Implementación de `sendWhatsAppAlert`.
- [test-whatsapp-agent.ts](file:///c:/CAMPAMENTO%20BASE%20DRAKO/drako_base/scripts/test-whatsapp-agent.ts) — Script de verificación.
- **Logs**: Registrados en `logs/whatsapp-agent.log`.

## Guía de Autorización (Paso a Paso)
1. **Meta for Developers**: Crear app tipo "Business".
2. **Agregar WhatsApp**: Asociar la app con el Meta Business Account.
3. **Registrar Número**: Verificar vía SMS/Llamada.
4. **Facturación**: Configurar método de pago en Business Manager (obligatorio para plantillas).
5. **Token Permanente**: Crear "System User" con rol Administrador, asignar activos y generar token con permisos `whatsapp_business_management` y `whatsapp_business_messaging`.
6. **Webhooks**: Suscribir `whatsapp_business_account` con URL HTTPS y token de verificación.

## Seguridad y Privacidad
- **Logging**: Registrar eventos sin exponer tokens ni datos sensibles del usuario (usar hashes o metadatos).
- **Auditoría**: Historial de aprobación de plantillas y campañas masivas.
- **Privacidad**: Almacenar registros de *opt-in*. Cumplimiento de GDPR (minimización de datos).
- **Cifrado**: HTTPS/TLS obligatorio para Graph API y Webhooks.

---
*Drako Connector System — WhatsApp Enterprise Integration.*
