# Blueprint & SaaS Factory v1

## Qué es
El Blueprint define el tipo de negocio, objetivo principal y fase de madurez del SaaS. A partir de ese perfil, el sistema organiza módulos activos y planificados por fases (instalación, captación, retención y escala).

## Tablas nuevas
- `saas_blueprints`: perfil del negocio (tipo, objetivo, fase, notas).
- `saas_modules`: módulos del SaaS, con estado, fase e importancia.
- `saas_interview_answers`: respuestas de la entrevista rápida.

## Mapeo de módulos
Los módulos reflejan lo ya existente en el sistema:
- ECONOMY, HR, EMAIL_INTAKE, SOCIAL
- APPOINTMENTS, CUSTOMERS, CLIENT_PORTAL, STAFF_PORTAL
- DOMAINS, OWNER_CONTROL, AUTOPILOT

## Entrevista rápida
El formulario captura 5–7 señales básicas (tamaño, ticket, redes, email intake, dolor principal). Con ellas se genera una propuesta determinista de fases y módulos recomendados sin IA externa.

## Integración con Owner Control
Owner Control usa el blueprint para:
- Resumir la fase y el número de módulos activos/planificados.
- Detectar módulos críticos faltantes y alimentar Autopilot con acciones recomendadas.

