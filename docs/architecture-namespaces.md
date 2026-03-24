# Architecture Namespaces

## Canonical Core

Path: `src/lib/campamento-base`

Used for:
- factory
- provisioning
- orchestrators
- templates
- contracts
- analytics/holding
- core business modules

## Specialized Social Automation

Path: `src/lib/campobase`

Used for:
- Campo Base social automation
- limited social automation services
- modules not equivalent to the core factory

## Architectural Rules

- `campobase` does NOT replace `campamento-base`.
- `campamento-base` must NOT be migrated to `campobase` without a new audit.
- Any future consolidation must be explicit, audited, and module by module.

## Risk

- Removing `campamento-base` breaks the core.
- Removing `campobase` breaks the social automation layer.
- Both coexist with distinct roles.
