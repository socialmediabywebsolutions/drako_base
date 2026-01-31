---
id: mentoria-global-blueprint
version: v1
scope: saas-educativo
status: active
owners: [drako-team, campamento-base]
tags: [internacionalización, estrategia, despliegue, multi-tenant, legal, métricas]
applies_to: [mentor-ia]
---

# 🚀 Plan de Despliegue Multiterritorio – MentorIA Escolar

Este documento establece la hoja de ruta estratégica y técnica para el lanzamiento de MentorIA Escolar en España, México, Colombia, Argentina y Chile, abarcando desde la localización de contenidos hasta la arquitectura multi-tenant y métricas de éxito.

---

## 1. Localización de Contenidos y Prompts
Se basa en el [Catálogo de Prompts Globales](file:///c:/CAMPAMENTO%20BASE%20DRAKO/drako_base/docs/knowledge/prompts/mentoria-global-prompts.v1.md), adaptando vocabulario, ejemplos culturales y referencias educativas.
- **Sensibilidad Cultural**: Uso de modismos locales y contextos escolares específicos (ej. Selectividad en España vs EXANI II en México).
- **Traducción Legal**: Adaptación de términos como NIF/CIF (ES) vs RFC (MX), NIT (CO), etc.

## 2. Conectores Nacionales
Implementación de un patrón de conexión común con aislamiento por tenant.
- **WhatsApp**: Canal primario para comunicación masiva (bots, tareas, notificaciones) vía WhatsApp Business API.
- **Email/Gmail**: Integración institucional por cliente (OAuth por tenant).
- **Redes Sociales**: Conectores para programación y monitoreo (FB, IG, LinkedIn, X).
- **Plataformas Locales**: Capacidad de integración con sistemas de gestión escolar nacionales.

## 3. Onboarding y Cumplimiento Legal
Flujo conversacional guiado para recopilar KPI operativos y datos fiscales.
- **Identificación Fiscal**: Adaptada a cada país (RFC, CUIT, RUN, etc.).
- **Pricing**: Planes en moneda local ajustados por paridad de poder adquisitivo.
- **Privacidad**: Aislamiento lógico de datos garantizando cumplimiento de normativas regionales (RGPD en España, LFPDPPP en México, Ley 1581 en Colombia, etc.).

## 4. Estrategia de Marketing
- **Orgánico**: Blogs educativos, webinars y SEO local.
- **WhatsApp Viral**: Inspirado en modelos como Luzia para lograr adopción masiva mediante bots publicitarios y demos.
- **Email Marketing IA**: Campañas segmentadas y automáticas basadas en ciclos escolares locales.

## 5. Arquitectura Multi-tenant y Escalado
Asegura que el crecimiento en un territorio no afecte a los demás.
- **Aislamiento de Datos**: Base de datos o esquema independiente por país.
- **Escalabilidad Horizontal**: Despliegue elástico (Kubernetes) según demanda geográfica.
- **Rendimiento**: Balanceo de carga inteligente y cuotas de recursos para evitar el efecto "noisy neighbor".

## 6. Soporte Técnico y Emocional Localizado
- **Soporte IA 24/7**: Chatbots con tonos lingüísticos locales (usted vs vos).
- **Agentes Emocionales**: Personalidad culturalmente sensible con referencias a figuras locales y contextos nacionales.
- **Soporte Humano**: Equipos remotos especializados por zona horaria.

## 7. Métricas Clave (KPIs)
Dashboard segmentado (Grafana/Power BI) con métricas por país:
- **Activación**: Tasa de finalización de onboarding y conversión a pago.
- **Retención**: Usuarios activos a 30/60/90 días.
- **Engagement**: DAU/MAU y mensajes por sesión.
- **Satisfacción**: NPS y CSAT territorial.

---

## 📊 Tabla Comparativa por País

| Configuración | España | México | Colombia | Argentina | Chile |
| :--- | :--- | :--- | :--- | :--- | :--- |
| **Idioma/Prompts** | Castellano neutro + Peninsular | Regionalismos (RFC) | Coloquialismos CO | Vos y modismos AR | Modismos CH |
| **Conectores** | Directos (WhatsApp/Gmail) | Full Stack + YouTube | Énfasis WhatsApp | Full Stack | Full Stack (TikTok) |
| **Precio Base** | ~30 € | ~600 MXN | ~50,000 COP | ~5,000 ARS | ~25,000 CLP |
| **Ley de Datos** | RGPD (UE) | LFPDPPP | Ley 1581/2012 | Ley 25.326 | Ley 19.628 |
| **Onboarding** | NIF/CIF (Calendario UE) | RFC (Zona Ho: MX) | NIT/PAS (Zona Ho: CO) | CUIT (Zona Ho: AR) | RUN (Chile) |

---

## 🔗 Documentación Relacionada
- [Catálogo de Prompts Globales](file:///c:/CAMPAMENTO%20BASE%20DRAKO/drako_base/docs/knowledge/prompts/mentoria-global-prompts.v1.md)
- [Plan Maestro SaaS Factory](file:///c:/CAMPAMENTO%20BASE%20DRAKO/drako_base/docs/knowledge/standards/saas-factory-master-plan.md)
- [Registro Central de Conocimiento](file:///c:/CAMPAMENTO%20BASE%20DRAKO/drako_base/docs/knowledge/knowledge-registry.v1.md)
