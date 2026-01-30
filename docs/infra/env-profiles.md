---
id: env-profiles
version: v1
scope: infra
status: active
owners: [infra-team]
tags: [environment, profiles, bindings, runtime]
applies_to: drako-base
not_applies_to: []
---

# 🌐 Entorno Declarado — Perfiles de Ejecución del Sistema

Este documento establece los perfiles oficiales de entorno utilizados por DrakoBase y declara los bindings y comportamientos esperados en cada uno.

---

## 🧭 Perfiles definidos

| Nombre       | Descripción                                  | Contexto de ejecución          |
|--------------|----------------------------------------------|--------------------------------|
| production   | Entorno en vivo                              | Cloudflare Workers (main D1)   |
| preview      | Entorno de staging / pre-release             | Workers Preview                |
| local        | Desarrollo local, testing en CLI             | Wrangler dev / Next.js dev     |

---

## 🔗 Bindings por entorno

| Binding         | Type   | Production | Preview | Local       |
|------------------|--------|------------|---------|-------------|
| draco_db         | D1     | ✅         | ✅      | ✅ (stub/dev)|
| ai               | AI     | ✅         | ✅      | ❌           |
| session_kv       | KV     | ✅         | ✅      | ❌           |
| logs_r2          | R2     | ✅         | ❌      | ❌           |
| emails_queue     | Queue  | ✅         | ✅      | ❌           |
| experimental_kv  | KV     | ❌         | ❌      | ✅           |

---

## 🛠️ Reglas operativas

- `env()` debe devolver solo bindings válidos en el contexto activo
- Local dev puede devolver `undefined` o valores stub si el binding no aplica
- Endpoints como `/api/debug/bindings` deben reflejar este perfil en tiempo real

---

## ✅ Verificación recomendada

- `/api/debug/bindings`: debe reportar entorno actual y bindings activos
- Wrangler `--env` debe coincidir con la tabla
- CI/CD debe validar bindings por entorno antes de deploy

---

Este documento actúa como contrato de entorno. Si cambia un binding, este archivo debe actualizarse junto con el `bindings-registry.md`.
