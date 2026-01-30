# Drako Agent Catalog v1 (Canon)

## Filosofía de 3 Capas

El ecosistema Drako se organiza en tres niveles de abstracción:

1.  **CORE (Cerebro)**: Agentes transversales que gestionan la lógica de negocio, orquestación y seguridad. Son el "sistema operativo".
2.  **PARTNER (Especialistas)**: Agentes verticales enfocados en tareas de negocio específicas (Marketing, Real Estate, Legal, etc.). Son los "empleados".
3.  **OPERATOR (Manos)**: Agentes puramente técnicos que interactúan con APIs y servicios (Stripe, Cloudflare, Email). Son las "herramientas".

---

## 1. CORE LAYER (12 Agentes)

Responsables de la gobernanza y orquestación.

| Agent ID | Responsabilidad | Entradas | Salidas |
| :--- | :--- | :--- | :--- |
| `core_interviews` | Conducir entrevistas iniciales y de seguimiento. | Chat stream, Contexto | Blueprint Draft, Fact extraction |
| `core_orchestrations` | Coordinar el flujo de trabajo entre agentes. | Trigger, Evento | Plan de ejecución, Job IDs |
| `core_supervisions` | Validar calidad y coherencia de los entregables. | Entregable borrador | Aprobación/Rechazo, Crítica |
| `core_architectures` | Diseñar la estructura técnica y de servicios. | Blueprint Draft | Stack definition, Resource map |
| `core_analyses` | Analizar datos complejos y extraer insights. | Raw Data, URLs | Structured Report, KPIs |
| `core_finances` | Calcular costes, precios y viabilidad económica. | Estructura de costes | Presupuesto, ROI projection |
| `core_legals` | Verificar cumplimiento normativo y legal. | Contexto, Jurisdicción | Risk Report, Compliance Flag |
| `core_securities` | Auditar seguridad y permisos. | Access Pattern | Security Alert, Audit Log |
| `core_knowledges` | Gestionar la Base de Conocimiento (RAG). | Query, New Doc | Context Retrived, Embeddings |
| `core_automations` | Detectar y configurar flujos automáticos. | Process Description | Workflow Definition (JSON) |
| `core_observabilities` | Monitorizar salud del sistema. | Logs, Metrics | Health Status, Alert |
| `core_deliveries` | Empaquetar y entregar el producto final. | Final Assets | Delivery Package, Release Note |

---

## 2. PARTNER LAYER (20 Agentes)

Especialistas por vertical.

### VERTICAL: SOCIAL / MARKETING
| Agent ID | Responsabilidad | Entradas | Salidas |
| :--- | :--- | :--- | :--- |
| `partner_media_strategies` | Definir estrategia de medios y canales. | Brand Info, Goals | Media Plan, Channel Mix |
| `partner_content_plannings` | Planificar calendario de contenidos. | Strategy, Trends | Content Calendar (Grid) |
| `partner_copywritings` | Escribir textos persuasivos y posts. | Topic, Tone | Post Copy, Article, Ad Text |
| `partner_visual_creations` | Generar o seleccionar assets visuales. | Prompt, Style Guide | Image URL, Video Script |
| `partner_social_analytics` | Analizar rendimiento en redes. | Social Metrics | Performance Report |
| `partner_ads_managements` | Gestionar campañas pagadas. | Budget, Audience | Campaign Structure, Ad Sets |
| `partner_competitor_watchings` | Vigilar movimientos de la competencia. | Competitor List | Alert, Monthly Report |
| `partner_trend_scoutings` | Detectar tendencias virales emergentes. | RSS, Social Stream | Trend Alert, Content Idea |
| `partner_brand_voices` | Asegurar coherencia de tono y voz. | Draft Content | Polished Content |
| `partner_campaign_orchestrations` | Coordinar lanzamiento de campañas. | Campaign Plan | Execution Timeline |

### VERTICAL: REAL ESTATE
| Agent ID | Responsabilidad | Entradas | Salidas |
| :--- | :--- | :--- | :--- |
| `partner_listings_managements` | Gestionar fichas de propiedades. | Raw Property Data | Optimized Listing |
| `partner_valuations` | Valorar inmuebles (ACM). | Property Specs | Price Estimate, Comps |
| `partner_market_analyses` | Analizar mercado inmobiliario local. | Area, Type | Market Report, Heatmap |
| `partner_lead_managements` | Cualificar y distribuir leads. | Inbound Lead | Qualified Lead, Score |
| `partner_rental_flows` | Gestionar flujo de alquileres. | Applicant Data | Scoring, Contract Draft |
| `partner_sales_flows` | Gestionar flujo de ventas. | Buyer/Seller Data | Sales Funnel Status |
| `partner_contracts_generations` | Redactar contratos legales inmobiliarios. | Terms, Parties | Legal Document |
| `partner_commission_trackings` | Calcular comisiones de agentes. | Deal Value, Split | Payroll Entry |
| `partner_fiscal_accountings` | Gestionar fiscalidad inmobiliaria. | Transaction Data | Tax Summary |
| `partner_customer_screenings` | Verificar solvencia de inquilinos/compradores. | Docs (DNI, Nómina) | Risk Assessment |

---

## 3. OPERATOR LAYER (12 Agentes)

Manos técnicas (Integraciones).

| Agent ID | Integración | Función Principal |
| :--- | :--- | :--- |
| `operator_stripe_billings` | Stripe Billing | Crear suscripciones, facturas, clientes. |
| `operator_stripe_meterings` | Stripe Usage | Reportar consumo (metered billing). |
| `operator_cloudflare_provisionings` | Cloudflare API | Crear proyectos Pages/Workers/D1. |
| `operator_d1_migrations` | Cloudflare D1 | Ejecutar migraciones SQL. |
| `operator_kv_sessions` | Cloudflare KV | Gestionar sesiones y caché rápida. |
| `operator_r2_documents` | Cloudflare R2 | Subir/Bajar archivos (imágenes, PDFs). |
| `operator_queues_dispatchings` | Cloudflare Queues | Encolar tareas asíncronas. |
| `operator_cron_schedulers` | Cloudflare Cron | Programar tareas recurrentes. |
| `operator_oauth_connections` | OAuth 2.0 | Gestionar tokens de redes sociales. |
| `operator_email_intakes` | IMAP/SMTP/API | Leer y enviar correos transaccionales. |
| `operator_calendar_syncings` | CalDAV/Google | Sincronizar eventos y citas. |
| `operator_document_ocrings` | OCR Service | Extraer texto de imágenes/PDFs. |
