# Provisioning (SaaS Factory)

## Objetivo
Crear un SaaS “llave en mano” desde blueprint.

## Entrada
- name + slug
- nicho + objetivos
- módulos
- agentes por departamento
- dominios (canónico + custom opcional)

## Proceso (orden)
1) Validar slug unique
2) Upsert D1:
   - `saas`
   - `saas_projects`
3) Dominios en `saas_domains`:
   - canónico: primary + ACTIVE/verified (si es interno del holding)
   - custom: pending hasta verificación
4) Crear config inicial
5) Crear agentes base (si blueprint lo define)
6) Emitir eventos (provisioning.*)
7) Smoke tests:
   - `/api/health`
   - `/api/saas`

## Definition of Done
- aparece en `/api/saas`
- health lo detecta si es campamento/public
- dominio canónico listo para routing (ACTIVE/verified)

Si no aparece en `/api/saas`, es bug de listing/merge o de tenancy.

### Instanciar el Founder Twin en el nuevo SaaS

En cada creación de SaaS (blueprint → provisioning), se adjunta un **Founder Twin**:

- Copia los guardrails y “principios de producto” desde Campamento Base.
- Añade contexto del nicho (peluquería, clínica, tienda de animales, etc.).
- Se convierte en el revisor final de: módulos activados, pricing, riesgos, y checklist de release.

Esto evita que cada SaaS “se vaya por su lado” y mantiene un estándar único del holding.
