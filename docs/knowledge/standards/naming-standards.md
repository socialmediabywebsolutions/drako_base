---
id: naming-standards
version: v1
scope: holding
status: active
owners: [drako-team]
tags: [standards, naming]
applies_to: [all]
not_applies_to: []
---

# Naming Standards v1

## 1. Archivos de Conocimiento
- Formato: `kebab-case`.
- Versión: Incluir `.vN` si es una iteración mayor (ej. `saas-schema.v1.md`).
- Ubicación: Siempre bajo una de las subcarpetas de `docs/knowledge/`.

## 2. Eventos de DKS
- Namespace: `dks.*`
- Formato: `subsystem.action.status` (ej. `knowledge.captured.success`).

## 3. Agentes
- Formato: `snake_case` (ej. `customer_partner`, `social_agent`).

## 4. Tags de Metadatos
- Usar siempre minúsculas.
- Separar con comas en el frontmatter.
