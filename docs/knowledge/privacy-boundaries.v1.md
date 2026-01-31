---
id: privacy-boundaries
version: v1
scope: holding
status: active
owners: [drako-team]
tags: [security, privacy, boundaries]
applies_to: [all]
not_applies_to: []
---

# Privacy Boundaries v1

## 1. Principio de Aislamiento
El conocimiento generado dentro de un Tenant (cliente) es estrictamente privado. Ningún agente puede propagar información de un Tenant a otro sin un proceso de "Capsulización" (anonimización y generalización).

## 2. Capas de Acceso
- **Nivel 0 (Public)**: Standards y documentación general.
- **Nivel 1 (Partners)**: Conocimiento compartido entre agentes autorizados.
- **Nivel 2 (Tenant Explicit)**: Datos sensibles del cliente (GDPR).

## 3. Protocolo de Brecha
Ante cualquier sospecha de fuga de conocimiento entre fronteras, el agente debe emitir un evento `security.boundary.breach` y pausar su ejecución inmediatamente.
