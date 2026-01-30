---
id: dks-system-spec
version: v1
scope: holding
status: active
owners: [drako-team]
tags: [knowledge, dks, spec]
applies_to: [all]
not_applies_to: []
---

# DKS System Specification v1 — Drako Knowledge System

## 1. Misión
El Drako Knowledge System (DKS) es el sistema central de inteligencia colectiva del holding. Su objetivo es desacoplar el conocimiento operativo de la lógica de código, permitiendo que agentes y humanos operen sobre una base de verdad compartida, versionada y estructurada.

## 2. Capas de Conocimiento
1. **Holding (Standards)**: Reglas globales, arquitectura, estándares de comunicación y seguridad.
2. **SaaS (Packs)**: Playbooks y blueprints específicos para cada vertical (Clínicas, Salones, etc.).
3. **Tenant (Capsules)**: Conocimiento específico del cliente, aislado y protegido.
4. **Agente (Personas)**: Especialización técnica y roles funcionales.

## 3. Flujo de Aprendizaje (Learning Loop)
- **Harvesting**: Captura de datos de alta densidad.
- **Validation**: Verificación cruzada por agentes especializados.
- **Propagation**: Notificación de cambios vía eventos.
- **Versioning**: Cada cambio genera una nueva versión; nada se borra.

## 4. Gobernanza
El acceso a la KB se rige por el `AgentSpec` y las fronteras de privacidad definidas en `privacy-boundaries.v1.md`.
