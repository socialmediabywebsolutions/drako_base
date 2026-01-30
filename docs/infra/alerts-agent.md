---
id: alerts-agent
version: v1
scope: infra
status: active
owners: [infra-team]
tags: [alerts, agent, monitoring, automation]
applies_to: drako-base
not_applies_to: []
---

# 🛰️ Alerts Agent — Sistema de Notificación Basado en Estado

Este agente o función monitorea el endpoint `/api/status.json` y dispara alertas si detecta condiciones que amenacen la estabilidad, coherencia o gobernanza del sistema.

---

## 🔍 Condiciones de alerta

| Condición                                   | Severidad | Acción sugerida                    |
|--------------------------------------------|-----------|------------------------------------|
| watchdogAlerts.draftsInProduction = true   | 🔴 Crítica | Notificar a `infra-core` inmediatamente |
| bindings.unregistered.length > 0           | 🟠 Alta    | Alertar y bloquear deploy si es posible |
| ciVerifiers.[x] === "fail"                 | 🔴 Crítica | Revisión urgente del componente    |
| learningCycle.status = "inactive"          | 🟡 Moderada| Recordatorio para iniciar ciclo nuevo |
| infra.status !== "stable"                  | 🔴 Crítica | Escalar a operaciones              |

---

## 🔔 Canales de notificación

- Slack: #infra-alerts
- Email: ops-alerts@drako.group
- Cloudflare Queues (para logging y fallback)
- Discord bot (opcional para equipo Dev interno)

---

## 🧪 Frecuencia de verificación

- Manual: desde panel de administración
- Automática: cada 10 minutos (via Worker Cron o CI)
- Post-deploy: como hook de verificación (antes del merge a `main`)

---

## 🧩 Sugerencias de implementación

- Worker Function con fetch → análisis → alerta
- Uso de KV para estado anterior (evitar alertas repetidas)
- Webhook para integración con observabilidad externa (Grafana, Opsgenie, etc.)

---

📌 Este agente permite que la infraestructura no solo se vea, sino que **reaccione activamente ante desviaciones**.
