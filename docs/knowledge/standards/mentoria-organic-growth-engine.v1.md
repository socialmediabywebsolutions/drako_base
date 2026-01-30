---
id: mentoria-organic-growth-engine.v1
title: "MentorIA Escolar: Motor de Crecimiento Orgánico (0-200)"
description: "Protocolos automatizados para adquisición viral, referidos y retención emocional sin inversión publicitaria."
version: 1.0.0
last_updated: "2026-01-30"
author: "Drako Factory / Growth Orchestrator"
tags: ["growth", "organic", "viral", "retention", "mentoria"]
---

# 🚀 Motor de Crecimiento Orgánico (Fase 0-200 Alumnos)

**Objetivo:** Alcanzar 200 alumnos activos.
**Restricciones:** 0€ Paid Media | No tocar precios | Coste IA < 3.00€.

---

## 1️⃣ Activación: Demo Viral 24h (`mentorIA_viral_24h`)
*El gancho principal para romper la barrera de entrada.*

### Lógica del Flujo
1.  **Trigger:** Usuario nuevo se registra (lead) O Alumno activo con historial < 7 días.
2.  **Acción Inmediata:**
    *   Conceder `access_level: FULL` durante 24 horas.
    *   **WhatsApp (Orquestador):**
        > "👋 Tienes acceso completo a MentorIA durante 24h. Si te ayuda hoy con los deberes, imagina tenerlo todo el mes 😉"
3.  **Cierre (T+24h):**
    *   Revocar acceso.
    *   **WhatsApp (Orquestador):**
        > "⏰ Se ha acabado tu acceso gratuito. Por menos de lo que cuesta una clase particular, seguimos contigo todo el mes."
4.  **Registro:** Tag `conversion_source = "viral_24h"`.

---

## 2️⃣ Sistema de Referidos (`mentorIA_referral_system`)
*Convertir el éxito académico en moneda de cambio.*

### Lógica del Flujo
1.  **Trigger:** Alumno desbloquea insignia (Badge) O mejora nota registrada.
2.  **Oferta Automática:**
    *   **WhatsApp (Orquestador):**
        > "🏆 Has desbloqueado una insignia. Si un amigo tuyo usa MentorIA hoy, tú ganas 7 días extra gratis. Tu código: [CODE]"
3.  **Conversión:**
    *   Amigo se registra con `referral_code`.
    *   **Recompensa:** +7 días de suscripción al `referral_parent`.
4.  **Límites:** Máximo 2 referidos activos/mes por alumno.

---

## 3️⃣ Refuerzo Emocional Parental (`mentorIA_parental_reinforcement`)
*Marketing invisible: Validar la decisión de compra del pagador.*

### Lógica del Flujo
1.  **Trigger:** `improvement_detected` (constancia o rendimiento).
2.  **Acción:**
    *   **WhatsApp (a Padre/Madre):**
        > "Hola 👋 Queríamos contarte que [Nombre] está avanzando muy bien. Hoy ha desbloqueado la insignia *[Nombre Insignia]* por su esfuerzo. Solo queríamos que lo supieras 😊"
3.  **Efecto Esperado:** Reducción de Churn voluntario (validación de valor).

---

## 4️⃣ Re-enganche Automático (`mentorIA_reengagement_protocol`)
*Rescate de alumnos fríos antes de que cancelen.*

### Lógica del Flujo
1.  **Trigger:** `last_session > 3 days` (Alerta Amarilla).
2.  **Intervención 1 (T+3d):**
    *   **WhatsApp (Orquestador):**
        > "Ey 👀 Tengo un truco rápido para [Materia difícil]. Son 3 minutos. ¿Lo vemos ahora?"
3.  **Intervención 2 (T+5d - Si no hubo respuesta):**
    *   Reintento con enfoque diferente (ej. emocional/motivacional).
4.  **Fallo:** Si T+7d sin actividad -> Marcar `risk_churn = true` -> Escalar a reporte del fundador.

---

## 5️⃣ Métricas Diarias: Growth Flash Report
*Informe automático a las 08:00 AM.*

| KPI | Definición | Objetivo Fase |
| :--- | :--- | :--- |
| **New Users** | Altas totales ayer. | > 2 / día |
| **Viral Conv** | % Nuevos que vienen de `viral_24h`. | > 20% |
| **Referrals** | Nº Referidos activos actuales. | > 10 |
| **Coste IA** | Coste medio computacional ayer. | < 3.00€ |
| **Churn W** | Tasa de cancelación semanal. | < 5% |

**🛡️ Kill Switch:** Si `Coste IA > 3.50€` O `Churn > 6%` -> **BLOQUEO TOTAL** de nuevos experimentos.

---

## 6️⃣ Condición de Salida (Fase 1 Completada)
El sistema notificará automáticamente al Founder cuando se cumpla:

1.  [ ] **Alumnos Activos ≥ 200**
2.  [ ] **Churn Mensual < 5%**
3.  [ ] **Coste IA Promedio < 3€**

✅ **Acción:** Marcar Fase = `READY_FOR_PAID`. Habilitar inversión en Ads.
