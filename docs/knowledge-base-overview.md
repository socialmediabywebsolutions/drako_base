# Knowledge Base & Playbooks v1

## Tablas
- `saas_knowledge_spaces`: espacios por área.
- `saas_knowledge_documents`: documentos (manuales, checklists, scripts, policies).
- `saas_knowledge_links`: relaciones a servicios, empleados, roles, tareas o autopilot keys.

## Repositorio
`src/lib/knowledge/repository.ts` expone CRUD de espacios, documentos y links con soporte D1 + demo-store.

## UI
- Owner: sección Knowledge en `/saas/[id]` para crear y editar playbooks.
- Tasks: panel de detalle muestra playbooks recomendados por `autopilotKey` o tags.
- Staff Portal: panel “Playbooks para hoy” con docs vinculados a empleado/servicios.

## Roadmap IA
La base queda lista para que agentes (EmployeePartner, CustomerPartner, SocialAgent, HRComplianceAgent) lean estos documentos para decisiones futuras.

## Knowledge v1.1
- Metadatos en documentos: `audience` (OWNER/STAFF/BOTH) e `importance` (INFO/STANDARD/CRITICAL).
- Editor de enlaces por documento para conectar con servicios, roles, empleados, tasks o `autopilotKey`.
- Tasks y Staff Portal priorizan docs por enlaces explícitos + metadatos de audiencia/importancia.
