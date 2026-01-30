---
id: dashboard-schema
version: v1
scope: infra
status: active
owners: [infra-team, drako-core]
tags: [dashboard, monitoring, status, infra]
applies_to: drako-base
not_applies_to: []
---

# 📊 Dashboard Operativo — Esquema Declarado

Este documento define los componentes mínimos que debe mostrar cualquier visualización operativa de la infraestructura Workers/OpenNext para reflejar su salud, cumplimiento y evolución.

---

## 🧱 Secciones mínimas

### 1. 🩺 Estado General (desde `status.md`)

| Campo                  | Fuente             |
|------------------------|--------------------|
| Última actualización   | `status.md`        |
| Artefactos activos     | `knowledge-registry.v1.md` |
| Ciclo de aprendizaje   | `learning-cycle.md` |
| Estado de Infra        | `infra-status.md`  |

---

### 2. 🔗 Bindings (desde `bindings-registry.md`)

- Tabla de bindings por entorno
- Status: active / draft / deprecated
- Diferencias entre `wrangler.toml` y documentación

---

### 3. 🌐 Perfiles de Entorno

- Perfil activo detectado (`getCloudflareContext()`)
- Binding inconsistentes en perfil actual
- Alertas si se usan bindings no declarados

---

### 4. 🐶 Watchdog Alerts

- Drafts activos en producción
- Bindings no registrados
- Conflictos entre entornos

---

### 5. ✅ CI/CD Verifiers

- Última ejecución de cada verificador
- Resultado: OK / WARN / FAIL
- Logs de validación (link o embed)

---

## 🧩 Integración sugerida

- Formato exportable: `status.json` o `infra.json`
- Visualización embebida vía panel interno (DevOps) o script CLI
- Sincronización diaria o en cada merge a `main`

---

📌 Este esquema permite que la infraestructura no solo esté viva, sino **visible para todos los equipos** sin necesidad de leer archivos técnicos.
