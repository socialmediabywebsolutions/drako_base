---
id: mentoria-execution-control.v1
title: "MentorIA Escolar: Sistema de Ejecución y Control"
description: "Protocolos diarios de automatización, alertas inteligentes y reglas de estabilidad para la gestión operativa."
version: 1.0.0
last_updated: "2026-01-30"
author: "Drako Factory / Execution Agent"
tags: ["execution", "control", "automation", "governance", "mentoria"]
---

# ⚙️ MentorIA Escolar: Sistema de Ejecución Diaria

Este documento define las reglas operativas estrictas para pasar de la estrategia a la ejecución automatizada.

## 1. Sistema Auto-Pilot (Rutinas Diarias)
*Se ejecuta sin intervención humana cada mañana a las 08:00 AM (Hora local del Fundador).*

*   **Diagnóstico de Salud:** Escaneo de logs de Stripe y Cloudflare.
*   **Patrulla de Retención:**
    *   Identifica alumnos con `última_conexión > 3 días`.
    *   **Acción:** Dispara mensaje WhatsApp de re-enganche (Agente Orquestador).
*   **Auditoría de Costes:** Calcula coste acumulado del mes vs presupuesto.
*   **Reporte Flash:** Envía **1 solo mensaje WhatsApp** al Fundador con el resumen de "Panel de Control Mental".

---

## 2. Alertas Inteligentes (Zero Noise Policy)
Solo se notifica al fundador si se cumple una condición crítica. Si no, el sistema se autocorrige.

| Condición | Causa Probable | Acción Automática | Notificación Fundador |
| :--- | :--- | :--- | :--- |
| **Coste IA > 3.50€/usuario** | Bucles en conversaciones o modelos demasiado potentes para tareas simples. | Degradar temporalmente a modelos "Cost Saver" para tareas no críticas. | 🚨 **ALERTA COSTE**: Revisar prompts. |
| **Churn Semanal > 6%** | Problema técnico general o insatisfacción masiva. | Activar "Protocolo Retención Extrema" (Oferta 50% descuento temporal). | 🚨 **ALERTA CHURN**: Detener marketing. |
| **Actividad < 10 min/día** | Contenido aburrido o falta de engagement. | El Agente Cognitivo inyecta más gamificación (Bonus XP). | ⚠️ **AVISO**: Engagement bajo. |
| **Uso Psicólogo > 40%** | Crisis de salud mental en la base de usuarios. | Escalar a soporte humano/tutor legal casos de riesgo. | 🚨 **ALERTA SALUD**: Revisar logs Psicólogo. |

---

## 3. Panel de Control Mental (The Daily 5)
El mensaje diario de WhatsApp debe contener EXACTAMENTE esto:

1.  **👥 Alumnos Activos:** Total suscritos y activos ayer.
2.  **💰 Beneficio Proyectado:** (Ingresos Recurrentes - Costes Variables - 1.200€ fijos).
3.  **⚠️ Riesgos:** Nº alertas amarillas/rojas activas.
4.  **🤖 Auto-Fixes:** Nº de intervenciones automáticas (ej. 12 mensajes de retención enviados).
5.  **✅ Acción Recomendada:** "Nada, todo OK" | "Revisar Prompt de Historia" | "Escalar servidores".

---

## 4. Sistema "No Me Jodas" (Reglas de Bloqueo)
Para proteger la rentabilidad y estabilidad ante impulsos emocionales.

*   **🚫 PROHIBIDO Lanzar Features** SI:
    *   Churn > 3%.
    *   Beneficio Neto < 0.
    *   Hay tickets de soporte técnico abiertos > 24h.
    *   *Razón:* Primero arregla el barco, luego píntalo.

*   **🚫 PROHIBIDO Tocar Precios** SI:
    *   No han pasado 3 meses desde el último cambio.
    *   No hay al menos 100 usuarios en el plan actual validando la conversión.
    *   *Razón:* La estabilidad genera confianza.

*   **🚫 PROHIBIDO Gastar en Ads** SI:
    *   LTV / CAC < 3 (El cliente no deja 3 veces lo que costó traerlo).
    *   La conversión de Landing a Pago es < 1%.
    *   *Razón:* No eches gasolina a un motor con fugas.

---

## 5. Modo Escala (Green Light Protocol)
Solo se permite acelerar (contratar, más ads, B2B) si se cumplen **TODAS** estas condiciones simultáneamente durante 2 semanas:

1.  [ ] **Rentabilidad Instancia:** Margen Neto > 6€ / alumno.
2.  [ ] **Estabilidad Técnica:** Uptime 99.9% y 0 errores críticos en logs.
3.  [ ] **Validación de Mercado:** > 50 Alumnos pagando precio completo (sin promo).
4.  [ ] **Automoción Real:** El fundador dedica < 1h/día a operativa (solo decisiones).

*Si se cumple:* **🚀 EJECUTAR ESCALADO** (Activar campaña B2B y subir presupuesto Ads x2).
