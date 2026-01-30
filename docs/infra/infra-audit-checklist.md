---
id: infra-audit-checklist
version: v1
scope: infra
status: active
owners: [infra-team, drako-core]
tags: [audit, checklist, infra, alerts, fallback]
applies_to: drako-base
---

# 🕵️ Auditor Inteligente de Infraestructura — Checklist Guía

Este documento guía el uso, mantenimiento e integración del script `alerts-check.ts`, el cual actúa como el guardián de la consistencia técnica de DrakoBase.

---

## 🛠️ ¿Qué hace este auditor?

El script `scripts/alerts-check.ts` realiza una auditoría automática comparando el estado real del sistema (runtime) contra las metas declaradas en el sistema de conocimiento.

**Verificaciones clave:**
1.  **Watchdog Sync**: Detecta si hay bindings en estado `draft` operando en producción.
2.  **Binding Governance**: Identifica bindings activos en el worker que no han sido registrados en `bindings-registry.md`.
3.  **CI Health**: Verifica el resultado de los validadores automáticos (Consistency, Profiles, etc.).

---

## 🚀 Uso Operativo

### Ejecución Manual
Para realizar una auditoría rápida de la salud del sistema:

```bash
npm run check:alerts
```

### 🔄 Sistema de Fallback Automático
El auditor es "inteligente" respecto al entorno:
1.  **Intento 1 (Producción)**: Consulta `https://drako.group/api/status.json`.
2.  **Intento 2 (Fallback Local)**: Si producción es inalcanzable, intenta `http://localhost:3000/api/status.json`.
3.  **Blindaje**: Si ambos fallan, el script aborta con un error crítico detallado.

---

## 🧪 Integración en CI/CD

Este script está diseñado para bloquear despliegues inseguros. Se recomienda su uso en:
- **Pre-deploy Hooks**: Ejecutar antes de `wrangler deploy`.
- **Integración Continua**: Paso obligatorio en PRs de infraestructura.

**Criterio de Fallo:**
- Si el script detecta alertas de severidad Crítica (Red) o Alta (Orange), terminará con `Exit Code 1`, deteniendo cualquier pipeline automático.

---

## 🚑 Resolución de Problemas

**Si ambos entornos fallan:**
1.  Verifica tu conexión a internet (para el endpoint de prod).
2.  Si estás trabajando localmente, asegúrate de tener el servidor encendido (`npm run dev`).
3.  Valida que el archivo `public/api/status.json` exista y sea un JSON válido.

---

## 👤 Responsabilidad
- **Mantenimiento**: `infra-team`.
- **Gobernanza de Reglas**: `drako-core`.
- Todo cambio en los perfiles de entorno o el registro de bindings debe ser reflejado inmediatamente en este auditor.

---

📌 *Este auditor no solo reporta errores; garantiza que lo que sabemos del sistema coincida con lo que el sistema está haciendo.*
