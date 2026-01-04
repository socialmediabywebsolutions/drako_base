# Arquitectura Drako (Campamento Base + Drako.Systems)

## Propósito real
**Drako** es un holding técnico-operativo para **crear, desplegar y gobernar múltiples SaaS** desde un núcleo central.

- **Campamento Base (base.drako.systems)**:
  - Registry (SaaS + dominios + estados) en D1
  - Economía (costes, tokens, Stripe, ROI)
  - Action Queue / Autopilot (tareas y automatizaciones)
  - Observabilidad global (eventos y métricas)
  - SaaS Factory (provisioning por blueprint)

- **Drako.Systems (drako.systems)**:
  - Primer SaaS del holding
  - Landing pública + onboarding conversacional
  - Catálogo de módulos y agentes por departamento
  - Puede ser SaaS productivo (CRM, dashboards, automatización)

## Dominios canónicos (obligatorio)
- Campamento Base: `base.drako.systems`
- Drako.Systems: `drako.systems`
- SaaS internos: `<saasSlug>.apps.drako.systems`
- Dominios propios: `cliente.com`, etc (verificación requerida)

Estos dominios activan el host-resolver y el routing real.

## Flujo Owner (tú) creando un SaaS
1) Entras a **Campamento Base** → “SaaS Factory”
2) Describes: nicho, objetivo, canales, restricciones, integraciones, presupuesto
3) El sistema genera **blueprint**:
   - módulos
   - agentes por departamento
   - plan/planes
   - conectores necesarios
4) Provisioning (idempotente):
   - upsert `saas`, `saas_projects`
   - alta dominios en `saas_domains` (canónico primary)
   - crea config inicial + agentes base (si aplica)
5) Validación:
   - `/api/health` (db + registry + dominios + hints)
   - `/api/saas` (lista completa fusionada)
6) Activación: `ACTIVE`

## Qué significa “listo para producción” (no es solo compilar)
- D1 binding `DRACO_DB` configurado en Pages
- Migraciones remotas aplicadas (incluye registry de dominios canónicos)
- Dominios custom en Pages + DNS + SSL ACTIVE
- `/api/health` en prod muestra: db OK + campamento + publicSaas + domains
- `/api/saas` lista mínimo: campamento-base y drako-systems
- Nada de 500 silencioso: 503 con reason/hint si falta algo

## Gemelo del fundador (CrisClone) — el “cerebro humano” reproducible

Campamento Base incluye un **Gemelo del fundador** (CrisClone): un agente/identidad interna que refleja tu criterio, tu estilo y tus reglas de negocio.

- Se usa para **crear y terminar SaaS por chat**: aterriza decisiones, rechaza “MVP cutre”, y mantiene coherencia entre productos.
- Actúa como **owner reviewer** de arquitectura, pricing, branding y riesgos.
- Está presente en Campamento Base y puede “instanciarse” en cada SaaS creado como **Founder Twin per-SaaS** (mismos principios, contexto específico del nicho).
- Sus “guardrails” se guardan en configuración (ver `drako-config.schema.json` y `campamento-kernel.schema.json`).

> Importante: Campamento Base es interno (no se vende). El Gemelo existe para acelerar tus decisiones y evitar deriva entre chats, agentes y SaaS.
