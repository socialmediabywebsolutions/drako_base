---
id: cron-runbook
version: v1
scope: infra
status: active
owners: [infra-team, drako-core]
tags: [infra, cron, schedule, automation, governance]
applies_to: drako-base
not_applies_to: []
---

# 🕰️ Cron Runbook — Verificaciones Autónomas de Infraestructura

Este documento define los ciclos programados que deben ejecutar los agentes IA para auditar, validar y proteger la integridad del sistema.

---

## 🔄 Tareas Automáticas Recomendadas

| Frecuencia   | Tarea                       | Script / Endpoint                         | Severidad |
|--------------|-----------------------------|--------------------------------------------|-----------|
| Cada 10 min  | Verificador de Alertas      | `alerts-agent.ts` (Worker)                | Alta      |
| Cada 1 hora  | Auditor Manual de Salud     | `alerts-check.ts` (via `npm run check:alerts`) | Alta      |
| Cada noche   | Snapshot de Infraestructura | `/api/status.json` → almacenar log externo | Media     |
| Semanal      | Limpieza de Drafts y Logs   | `scripts/purge-drafts.ts` (opcional)      | Baja      |

---
El Cron Runbook ha sido implementado y sincronizado con el sistema de conocimiento.

Acciones Realizadas:
Guía Maestra de Ciclos: Creado 
cron-runbook.md
 detallando las frecuencias y scripts para verificaciones autónomas.
Registro DKS: El artefacto ha sido integrado en el 
knowledge-registry.v1.md
.
Vinculación en Heartbeat: Se ha habilitado el acceso directo desde 
status.md
 bajo la sección de Auditoría y Verificación.
Con este documento, todos los procesos automáticos y programados del ecosistema DrakoBase quedan oficialmente orquestados y documentados. soul. soul. (rest of "soul" repetition removed)

cron-runbook.md
Open
knowledge-registry.v1.md
Open
status.md
Open

## 🛠️ Integración en CI/CD

Todos estos pasos pueden ejecutarse como **jobs programados** en tu plataforma de CI (GitHub Actions, Vercel Cron, Workers Cron, etc.).

Ejemplo para ejecutar el auditor:

```bash
npx tsx scripts/alerts-check.ts
```

Ejemplo para activar el Worker desde Wrangler:

```bash
npx wrangler deploy workers/alerts-agent.ts --name drako-alerts-agent
```

---

## 📌 Reglas del Sistema

1.  Si alguna tarea falla con severidad alta, debe activar notificación inmediata.
2.  Las tareas deben registrar logs para análisis evolutivo en el DKS.
3.  Cualquier verificación nueva debe añadirse aquí como una nueva fila.

---

Este archivo sirve como el plan maestro de ejecución autónoma del ecosistema DrakoBase.
