---
id: registry-registration-template
version: v1
scope: holding
status: active
owners: [drako-core]
tags: [template, dks, registry]
applies_to: [knowledge-registry.v1.md]
not_applies_to: []
---

# Template: Registro de Nuevos Artefactos DKS

🎯 **Objetivo**: Registrar un nuevo artefacto (template, pack, runbook, evento, cápsula, ADR) dentro del sistema Drako Knowledge System (DKS).

## 📥 Formato de Fila
Añadir una nueva fila al archivo `docs/knowledge/knowledge-registry.v1.md` siguiendo esta estructura:

| ID                     | Path                                            | Version | Status | Scope     | Owners         | Tags                                 |
|------------------------|-------------------------------------------------|---------|--------|-----------|----------------|--------------------------------------|
| [id-del-artefacto]     | [ruta-relativa-desde-docs/knowledge/]          | v1      | draft  | [scope]   | [equipo-owner] | [etiquetas de clasificación]         |

## ✅ Reglas de Validación
1. **Path**: Debe ser siempre relativo a `docs/knowledge/`.
2. **Scope**: Debe ser uno de: `holding`, `saas`, `tenant`.
3. **Status**: Usar `draft`, `active` o `deprecated`.
4. **Version**: Comienza en `v1` e incrementa manualmente.

## 📌 Ejemplos de Referencia

### 1. Evento de aprendizaje real
`| login-bug-hotfix | events/login-bug-hotfix-jan2026.md | v1 | draft | saas | support-team | [learning-loop, incident] |`

### 2. Nueva plantilla
`| runbook-marketing | templates/runbook-marketing.md | v1 | active | holding | marketing-core | [template, marketing] |`

### 3. Cápsula tenant-safe
`| capsule-fintech-alpha | capsules/fintech-alpha/v1.md | v1 | active | tenant | swarm-fintech | [capsule, onboarding] |`
