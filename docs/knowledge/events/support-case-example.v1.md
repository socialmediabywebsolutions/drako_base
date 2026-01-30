---
id: support-case-example
version: v1
scope: holding
status: active
owners: [support-team]
tags: [example, support, events]
applies_to: [customer-service]
not_applies_to: []
---

# Functional Example: Soporte Técnico Simulado (Ticket #8821)

Este ejemplo muestra cómo el DKS centraliza la información y los procedimientos ante un evento de soporte.

## 1. Evento Capturado
- **ID**: `evt_supp_8821`
- **Tenant**: `demo-salon-01`
- **Issue**: Fallo en sincronización de calendario con Stripe.
- **Timestamp**: 2026-01-28T10:00:00Z

## 2. Runbook Ejecutado (`base-stripe-sync-v1`)
El agente `customer_partner` activó el runbook de sincronización:
1. **Check Status**: Verificación de conectividad con Stripe API -> OK.
2. **Inspect D1**: Revisión de tabla `saas_domains` -> Desalineación detectada en webhook secret.
3. **Action**: Actualización de variable de entorno vía Cloudflare API.
4. **Validation**: Re-intento de Webhook -> Success.

## 3. Resultado en DKS
- El conocimiento sobre este fallo específico (causa raíz: expiración de secret) se ha propagado al `agent-kb` del `stripe_operator` para prevenir recurrencia.
- La base de conocimiento del Tenant se actualizó con la resolución para futuras consultas del cliente.

## 4. Aprendizaje (Learning Loop)
Se ha propuesto una actualización al [Standard de Seguridad](file:///c:/CAMPAMENTO%20BASE%20DRAKO/drako_base/docs/knowledge/standards/dks-system-spec.md) para incluir rotación automática de secretos cada 90 días.
