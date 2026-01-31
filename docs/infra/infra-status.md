---
id: infra-status-opennext
version: v1
scope: infra
status: active
owners: [infra-team, drako-core]
tags: [infrastructure, status, opennext, workers]
applies_to: drako-base
not_applies_to: []
---

# 🏗️ Infraestructura Estabilizada — Cloudflare Workers + OpenNext

Este snapshot certifica que el proyecto **DrakoBase-3** ha completado su migración estructural a Cloudflare Workers usando OpenNext, y que se encuentra en estado de producción técnica verificada.

---

## ✅ Estado actual

- Arquitectura: `Workers-first` con entrada única `.open-next/worker.js`
- Contexto de ejecución: `getCloudflareContext()` en uso estricto
- `env()`: solo accesible en handlers activos (Request Context enforcement)
- Eliminado: `@cloudflare/next-on-pages` y runtime="edge" de todos los handlers
- Endpoints: `/api/health` y `/api/debug/bindings` con diagnóstico completo

---

## 🧪 Verificación técnica

| Chequeo                 | Resultado   |
|--------------------------|-------------|
| Linting                 | ✅ Pasado    |
| Type checking           | ✅ Pasado    |
| Runtime bindings        | ✅ D1 y AI   |
| Smoke test API health   | ✅ Adapter: OpenNext |
| Smoke test bindings     | ✅ hasDracoDb: true |
| Final build (Windows)   | ⚠️ Falla por EBUSY (limitar a WSL, Linux o CI/CD) |

---

## 🚧 Notas y restricciones

- ⚠️ **EBUSY error**: El build final falla en Windows al copiar artefactos.  
  👉 Ejecutar `npm run deploy` en:  
  - WSL  
  - Linux  
  - CI/CD (recomendado)

---

## 📌 Recomendaciones operativas

- Usar CI/CD para despliegue estable (`npm run deploy`)
- Continuar monitoreo desde `/api/debug/bindings` y `/api/health`
- Registrar futuros bindings y contextos en `infra/bindings-registry.md`

---

Este archivo representa el **cierre del proceso de migración** y declara la nueva arquitectura como **la infraestructura oficial del sistema.**
