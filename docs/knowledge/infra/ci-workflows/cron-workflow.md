---
id: dks-cron-workflow
version: v1
scope: infra
status: active
owners: [drako-core]
tags: [ci, github-actions, automation, cron, verification]
applies_to: drako-base
not_applies_to: []
---

# 🔁 DKS Cron Workflow — GitHub Actions Automation

Este documento describe el workflow automatizado de GitHub Actions que ejecuta de forma cíclica los verificadores clave del ecosistema DrakoBase.

---

## 🎯 Objetivo

Garantizar la **verificación continua** del estado de la infraestructura y la coherencia del sistema a través de un proceso automatizado ejecutado desde la nube.

---

## 📋 Tareas Automatizadas

| Frecuencia    | Acción                         | Responsable         | Severidad |
|---------------|--------------------------------|----------------------|-----------|
| Cada 10 min   | `alerts-agent.ts`              | Cloudflare Worker    | Alta      |
| Cada 1 hora   | `alerts-check.ts`              | GitHub Actions       | Alta      |
| Diario (03:00)| Snapshot `/api/status.json`    | GitHub Actions       | Media     |
| Semanal       | `purge-drafts.ts` (opcional)   | GitHub Actions       | Baja      |

---

## 🧱 Archivo de Configuración

El workflow se encuentra en:

`.github/workflows/dks-cron-runbook.yaml`

---

## 🚀 CI/CD Compatible

- Plataforma: GitHub Actions
- Despliegue recomendado: rama `main`
- Triggers: `schedule` + `workflow_dispatch`

---

## 🔗 Enlaces y Referencias

- 🔍 [alerts-check.ts](../../../scripts/alerts-check.ts)
- 🛰️ [alerts-agent.ts](../../../workers/alerts-agent.ts)
- 📊 [status.json](../../../public/api/status.json)
- 🗑️ [purge-drafts.ts](../../../scripts/purge-drafts.ts) *(si existe)*

---

## 📌 Consideraciones

- El workflow está sincronizado con el `cron-runbook.md`.
- Cualquier modificación debe reflejarse en el artefacto del conocimiento.
- Logs y fallos deben revisarse desde la interfaz de GitHub Actions.

---

Este archivo representa la **orquestación viva del mantenimiento técnico autónomo del holding.**
