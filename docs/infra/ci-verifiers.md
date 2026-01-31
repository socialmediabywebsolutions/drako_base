---
id: ci-verifiers
version: v1
scope: infra
status: active
owners: [infra-team]
tags: [ci, validation, bindings, env, consistency]
applies_to: drako-base
not_applies_to: []
---

# ✅ CI/CD Verifiers — Infraestructura Consistente por Diseño

Este documento define los verificadores que deben ejecutarse antes de un despliegue o integración para garantizar que el sistema está **alineado con su conocimiento registrado**.

---

## 🔎 Validaciones por componente

### 1. 🔗 Bindings Registry

**Script:** `scripts/check-bindings-registered.ts`  
**Verifica que:**
- Todos los `env().XYZ` usados estén en `bindings-registry.md`
- No existan bindings en runtime que no estén documentados
- Los bindings `deprecated` no estén activos en production

---

### 2. 🌐 Perfiles de Entorno

**Script:** `scripts/check-env-profile.ts`  
**Verifica que:**
- El entorno actual (por `getCloudflareContext().env`) coincida con el declarado (`env-profiles.md`)
- No se utilicen bindings no permitidos en el perfil actual
- En local, que los bindings faltantes tengan stub o fallback explícito

---

### 3. 🐶 Infra Watchdog

**Script:** `scripts/check-watchdog-consistency.ts`  
**Verifica que:**
- No existan `drafts` en producción
- Wrangler `bindings` coincidan con documentación
- Todos los `wrangler.toml` tengan consistencia entre `name`, `env`, `bindings` y `profile`

---

## 🧪 Ejecución recomendada

- 🧩 **CI/CD hooks:** antes de `npm run deploy`  
- 🧪 **PR checks:** en pull requests que afecten infraestructura  
- 🚧 **Dev scripts:** en `dev:check-infra`

---

## 📌 Resultado esperado

- Todos los artefactos de infraestructura se alinean con la verdad declarada.
- El sistema se blinda ante errores de configuración silenciosos.
- El equipo DevOps tiene retroalimentación inmediata antes de cada cambio.

---

Este archivo sirve como contrato operativo entre conocimiento, código y CI. Si algo cambia, aquí se actualiza.
