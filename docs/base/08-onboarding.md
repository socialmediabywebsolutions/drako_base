# Onboarding (Entrevista inicial → Blueprint → Activación)

## Objetivo
Convertir una idea en un SaaS operativo usando conversación y datos reales.

## Entrevista (núcleo)
- Nicho (clínica, peluquería, mascotas, lavandería, estética, etc.)
- Objetivo (leads, reservas, ventas, soporte, contenidos)
- Canales (web, IG, FB, LinkedIn, WhatsApp, email)
- Restricciones (presupuesto, tono, legal, idiomas)
- Assets (logo, fotos, PDFs/catálogos)

## Blueprint (salida)
- Módulos activados
- Agentes por departamento
- Conectores requeridos
- Planes/precios (si aplica)

## Activación (registry)
- Upsert: `saas`, `saas_projects`
- Dominios: `saas_domains` (canónico primary; custom pending)
- Smoke: `/api/health` + `/api/saas`

## Regla
Sin registry D1 y dominios ACTIVE/verified, no existe “SaaS real”.
