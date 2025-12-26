# Tasks & Autopilot Execution v1

## Qué es
Este módulo convierte recomendaciones del Autopilot en tareas persistentes y asignables, visibles tanto para el dueño como para el staff.

## Tablas nuevas
- `saas_tasks`: tareas con estado, severidad, categoría, asignación y metadata.
- `saas_task_events`: historial de cambios y comentarios.

## Repositorio
`src/lib/tasks/repository.ts` implementa CRUD y eventos con soporte D1 + demo-store.

## Autopilot → Tasks
`src/lib/tasks/autopilot-bridge.ts` materializa acciones del snapshot en tareas nuevas usando `metadata.autopilotKey` para evitar duplicados.

## UI
- Owner: `/saas/[id]` incluye sección Tasks y botón “Convertir en tareas” en Owner Control.
- Staff: Staff Portal muestra “Mis tareas” con acciones rápidas.

