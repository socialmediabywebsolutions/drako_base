---
id: bindings-registry
version: v1
scope: infra
status: active
owners: [infra-team]
tags: [bindings, environment, infrastructure]
applies_to: drako-base
not_applies_to: []
---

# 🔗 Bindings Registry — Cloudflare Runtime Context

Este documento define y registra los bindings activos de la infraestructura de DrakoBase, incluyendo su tipo, alcance, y configuración por entorno (`production`, `preview`, `local`).

---

## 🧬 Tabla de Bindings

| Name           | Type   | Scope       | Description                                 | Environments           | Status  |
|----------------|--------|-------------|---------------------------------------------|------------------------|---------|
| draco_db       | D1     | tenant      | Base de datos principal por tenant          | prod / preview / local | active  |
| ai             | AI     | holding     | Modelo de inferencia compartido             | prod / preview         | active  |
| session_kv     | KV     | tenant      | Almacenamiento de sesión temporal           | prod / preview         | active  |
| logs_r2        | R2     | holding     | Backup y storage de registros               | prod                   | active  |
| emails_queue   | Queue  | holding     | Envío de emails transaccionales             | prod / preview         | active  |
| experimental_kv| KV     | dev-only    | Feature flags para pruebas internas         | local                  | draft   |

---

## 🔍 Validación en runtime

Verificable vía:
- `/api/debug/bindings`: listado e introspección por entorno
- `getCloudflareContext().env` (ver `src/lib/cf.ts`)
- CI/CD: validadores de bindings en `predeploy` hooks

---

## 📌 Reglas y recomendaciones

- Todo nuevo binding debe registrarse aquí con nombre, tipo y scope.
- Evitar hardcodear valores: usar `env()` exclusivamente.
- El campo `Status` debe ser `active`, `draft` o `deprecated`.

---

Este archivo funciona como fuente de verdad de infraestructura compartida entre entornos y debe ser consultado por agentes de verificación y despliegue.
