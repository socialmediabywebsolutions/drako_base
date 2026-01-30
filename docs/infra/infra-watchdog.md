---
id: infra-watchdog
version: v1
scope: infra
status: active
owners: [infra-team]
tags: [watchdog, infra, monitoring, bindings]
applies_to: drako-base
not_applies_to: []
---

# 🐶 Infra Watchdog — Binding & Entorno Monitor

Este artefacto funciona como guía operativa y sistema de control pasivo para vigilar que los bindings declarados en `wrangler.toml`, `env()` y `getCloudflareContext()` estén correctamente **registrados**, **validados** y **sincronizados**.

---

## ✅ Lo que este watchdog revisa

| Verificación                          | Descripción                                                   |
|--------------------------------------|---------------------------------------------------------------|
| Bindings no registrados              | Detecta uso de env().XYZ no listado en `bindings-registry.md` |
| Drafts vencidos                     | Señala bindings con `status: draft` que siguen activos en prod |
| Conflictos de nombres                | Evalúa inconsistencias entre `wrangler.toml` y el registry     |
| Fugas locales                        | Alerta si hay bindings solo en `local`, sin plan de promoción |
| Ambigüedad de `env()`                | Detecta acceso a env() fuera de un handler válido             |

---

## 🧩 Cómo se activa

Este documento no es un script. Actúa como:
- Checklist manual para PRs de infraestructura
- Base para validadores CI/CD (`check-bindings.sh`, etc.)
- Guía para nuevos miembros del equipo DevOps

---

## 🔁 Rutina recomendada

| Acción                          | Frecuencia |
|--------------------------------|------------|
| Revisar `status: draft`        | semanal    |
| Ejecutar verificación CI/CD    | en cada deploy |
| Validar nuevos bindings        | en PR o desde `/api/debug/bindings` |
| Auditar `wrangler.toml`        | mensual    |

---

📌 Este watchdog no impide nada, pero lo ve todo. Úsalo para prevenir errores de configuración invisibles.
