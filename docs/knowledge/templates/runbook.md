---
id: runbook-template
version: v1
scope: holding
status: active
owners: [drako-team]
tags: [template, runbook, operational]
applies_to: [all]
not_applies_to: []
---

# Runbook Template: {{title}}

## 1. Activación
**Disparador**: {{trigger_event_or_condition}}
**Gravedad**: {{level_info|standard|critical}}

## 2. Procedimiento (Paso a Paso)
1. **Verificación**: {{verification_step}}
2. **Acción**: {{action_step}}
3. **Validación**: {{validation_step}}

## 3. Rollback
En caso de fallo en el paso {{step}}, realizar: {{rollback_instructions}}

## 4. Referencias
- {{link_to_docs}}
- {{link_to_scripts}}
