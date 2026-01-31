---
id: dks-readme
version: v1
scope: holding
status: active
owners: [drako-team]
tags: [readme, dks, index]
applies_to: [all]
not_applies_to: []
---

# Drako Knowledge System (DKS) v1 — Source of Truth

Bienvenido al sistema de conocimiento central de Drako Group. Este repositorio es la **única fuente de verdad** (SSOT) para la operación, arquitectura y playbooks del holding y sus enjambres de agentes.

### 🩺 [Estado del Sistema](file:///c:/CAMPAMENTO%20BASE%20DRAKO/drako_base/docs/knowledge/status.md)
📊 Ver estado del sistema → [status.md](file:///c:/CAMPAMENTO%20BASE%20DRAKO/drako_base/docs/knowledge/status.md)

### 📘 [Historial de Actualizaciones](file:///c:/CAMPAMENTO%20BASE%20DRAKO/drako_base/docs/knowledge/update-log.md)
📘 Ver historial de actualizaciones → [update-log.md](file:///c:/CAMPAMENTO%20BASE%20DRAKO/drako_base/docs/knowledge/update-log.md)

## 📂 Estructura del Sistema

### 1. [Standards](file:///c:/CAMPAMENTO%20BASE%20DRAKO/drako_base/docs/knowledge/standards/)
Material de nivel holding. Define el "cómo" operamos.
- [DKS System Spec](file:///c:/CAMPAMENTO%20BASE%20DRAKO/drako_base/docs/knowledge/standards/dks-system-spec.md)
- [Naming Standards](file:///c:/CAMPAMENTO%20BASE%20DRAKO/drako_base/docs/knowledge/standards/naming-standards.md)
- [Privacy Boundaries](file:///c:/CAMPAMENTO%20BASE%20DRAKO/drako_base/docs/knowledge/privacy-boundaries.v1.md)
- [SaaS Factory Master Plan](file:///c:/CAMPAMENTO%20BASE%20DRAKO/drako_base/docs/knowledge/standards/saas-factory-master-plan.md)

### 2. [Packs](file:///c:/CAMPAMENTO%20BASE%20DRAKO/drako_base/docs/knowledge/packs/)
Playbooks específicos de las soluciones SaaS del holding (Packs verticales).
- Catálogo de Blueprints y Features recomendadas.

### 3. [Capsules](file:///c:/CAMPAMENTO%20BASE%20DRAKO/drako_base/docs/knowledge/capsules/)
Ejemplos seguros y anonimizados para tenants (Tenant-safe examples).

### 4. [Events](file:///c:/CAMPAMENTO%20BASE%20DRAKO/drako_base/docs/knowledge/events/)
Esquemas y registros de eventos simulados para entrenamiento y auditoría.
- [Ejemplo de Soporte Técnico](file:///c:/CAMPAMENTO%20BASE%20DRAKO/drako_base/docs/knowledge/events/support-case-example.v1.md)

### 5. [Templates](file:///c:/CAMPAMENTO%20BASE%20DRAKO/drako_base/docs/knowledge/templates/)
Plantillas estandarizadas para expandir el conocimiento.
- `agent-kb.md`, `swarm-kb.md`, `runbook.md`, `adr.md`, `capsule.md`.
- [SaaS Activation Playbook (Test Run)](file:///c:/CAMPAMENTO%20BASE%20DRAKO/drako_base/docs/knowledge/templates/test-run.md)
43: 
44: ### 6. [Prompts](file:///c:/CAMPAMENTO%20BASE%20DRAKO/drako_base/docs/knowledge/prompts/)
45: Catálogo de instrucciones maestras para agentes.
46: - [Factory Agents Prompts](file:///c:/CAMPAMENTO%20BASE%20DRAKO/drako_base/docs/knowledge/prompts/factory-agents.v1.md)
44: 
45: ### 6. [Connectors](file:///c:/CAMPAMENTO%20BASE%20DRAKO/drako_base/docs/knowledge/connectors/)
46: Manifiesto y especificaciones del sistema de integración universal.
47: - [Connector System Manifesto](file:///c:/CAMPAMENTO%20BASE%20DRAKO/drako_base/docs/knowledge/connectors/manifesto.md)
- [Connectors Overview](file:///c:/CAMPAMENTO%20BASE%20DRAKO/drako_base/docs/knowledge/connectors/overview.md)
- [Connectors Registry](file:///c:/CAMPAMENTO%20BASE%20DRAKO/drako_base/docs/knowledge/connectors/connectors-registry.md)

### 🛠 [Guía de Contribución](file:///c:/CAMPAMENTO%20BASE%20DRAKO/drako_base/docs/knowledge/how-to-contribute.md)
¿Quieres añadir conocimiento al DKS? Sigue nuestro flujo estándar.

## 🚀 Cómo usar este sistema
1. **Consulta**: Antes de cualquier acción crítica, los agentes deben leer los Standards relevantes.
2. **Registro**: Cada decisión importante debe documentarse usando la plantilla `adr.md`.
3. **Evolución**: Los playbooks se actualizan mediante el Learning Loop, asegurando que el conocimiento nunca quede obsoleto.

---
*Drako Knowledge System — Orchestrating Intelligence.*
