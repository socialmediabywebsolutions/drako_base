---
id: mentoria-growth-intelligence.v1
title: "MentorIA Escolar: Protocolos de Inteligencia de Crecimiento"
description: "Reglas de observación, medición y análisis para aprender del Motor de Crecimiento sin intervención."
version: 1.0.0
last_updated: "2026-01-30"
author: "Drako Factory / Growth Intelligence Agent"
tags: ["growth", "analytics", "intelligence", "observation", "mentoria"]
---

# 🧠 Agente de Inteligencia de Crecimiento (Growth Intelligence)

**Misión:** Observar, medir y aprender.
**Restricciones:** 🚫 NO cambiar precios. 🚫 NO crear features. 🚫 NO lanzar experimentos visibles.

---

## 1️⃣ Perfilado de Conversión (Tracking Schema)
Para cada alta nueva, el sistema registra obligatoriamente los siguientes metadatos para futura segmentación:

| Campo | Valores Posibles |
| :--- | :--- |
| `conversion_source` | `viral_24h` \| `referral` \| `direct` |
| `edad_alumno` | `int` (6-18) |
| `pais` | `ES` \| `MX` \| `CO` \| `AR` \| `CL` |
| `materia_principal` | Materia más consultada en primera sesión. |
| `agente_usado_principal` | `tutor` \| `cognitivo` \| `psicologo` |
| `latencia_sesion` | Minutos desde alta hasta primera interacción real. |
| `intensidad_24h` | Nº de mensajes en las primeras 24 horas. |
| `fast_converter` | `true` si convierte a pago < 48h. |

---

## 2️⃣ Protocolo de Análisis Semanal
*Se ejecuta automáticamente cada Domingo a las 23:59.*

El sistema genera un reporte interno (resumen) con los siguientes insights basados en datos reales:

### 🏆 Top Converters
*   **Mensajes Ganadores:** Los 3 textos (copy) de WhatsApp con mayor tasa de apertura/acción.
*   **Materias "Sticky":** Las 3 asignaturas que generan mayor retención a 7 días.

### 👤 Arquetipos (Personas)
*   **El Fiel (Non-Canceler):** Características comunes de usuarios con >30 días activos (ej. "Usa visuales + Edad 12 + MX").
*   **El Enfriado (Churn Risk):** Patrón común de usuarios que abandonan (ej. "Solo usa texto + Edad 16 + Sin interacción padres").

---

## 3️⃣ Alertas de Oportunidad (Opportunity Scout)
El sistema notifica al Founder **SOLO** si detecta patrones estadísticamente significativos para sugerir acciones futuras.

**Condiciones de Disparo:**
1.  **Patrón Repetido:** >5 casos idénticos de conversión rápida.
2.  **Anomalía de Engagement:** Una materia tiene +50% uso que la media.
3.  **Viralidad Geográfica:** Un país supera el ratio viral promedio en un 20%.

**Formato de Notificación:**
> "💡 **Oportunidad Detectada:** [Descripción del Patrón, ej. 'Alumnos de 15 años en Colombia convierten 2x rápido con dudas de Matematicas']. **Recomendación:** [Crear pack específico EBAU/ICFES Matematicas]."

⚠️ **NOTA:** El sistema SOLO recomienda. NUNCA ejecuta la acción automáticamente.

---

## 4️⃣ Condición de Salida (Growth Understood)
Cuando se cumplan los siguientes hitos:

1.  [ ] **Base de Usuarios:** ≥ 200 Alumnos activos.
2.  [ ] **Insights:** ≥ 3 Patrones de conversión claros identificados.

**Acción Automática:**
*   Generar artefacto final `growth-insights.v1.md`.
*   Marcar estado del sistema como `GROWTH_UNDERSTOOD`.
*   Autorizar transición a Paid Media (si procede según Founder).

---
*Este agente es los ojos y el cerebro analítico. No las manos.*
