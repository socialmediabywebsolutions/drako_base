# Connectors (Gmail / Drive / WhatsApp / Social)

## Objetivo
Que agentes trabajen con datos reales del cliente.

## Patrón
1) Cliente conecta credenciales (OAuth/tokens)
2) Guardar por tenant/saas (no hardcode en .env)
3) Agentes consumen con scope mínimo
4) Registrar eventos y resultados

## Prioridades
- Gmail: lectura/etiquetado; detectar facturas/reservas
- Drive/Dropbox: ingestión de PDFs/catálogos/assets
- WhatsApp: soporte y notificaciones (cuando aplique)
- Social (Meta/LinkedIn/X/Medium): publicación + scheduling

## Seguridad
- Tokens por tenant, rotación, revocación, scope mínimo
