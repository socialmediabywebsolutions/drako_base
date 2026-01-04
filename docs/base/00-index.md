# CAMPAMENTO BASE + DRAKO.SYSTEMS — Base de Conocimiento (SSOT)

> **Estado (SSOT):** Estos 20 archivos son la *fuente única* de verdad para todos los chats y copilotos.
> **Última actualización:** 2026-01-04. Incluye registry de dominios (migración **0061**), /api/saas fusionado (saas + projects + dominios), y /api/health con diagnóstico D1.

## Uso en ChatGPT (Proyectos) — para que TODOS los chats tengan el mismo mapa

1) En el proyecto de ChatGPT donde guardas esta base (ej. “CAMPAMENTO BASE DRAKO”), **sube/actualiza exactamente estos 20 archivos**.
2) Si ya existen versiones antiguas, **borra o reemplaza** para evitar duplicados (una sola copia por nombre).
3) Cuando abras un chat nuevo para crear/auditar un SaaS, empieza con:
   - “Lee `00-index.md` y usa el resto de archivos como fuente única de verdad”.
4) Si la arquitectura cambia (rutas, D1, dominios, migraciones), **regenera este pack** y reemplázalo completo.

## Cómo se usan estos 20 archivos (fuente única)

Estos 20 archivos son **la base canónica** de Campamento Base + Drako.Systems.

- Cualquier chat/agente que trabaje en este proyecto debe tratarlos como **source of truth**.
- Si algo del código/infra parece contradecirlos, se asume **desalineación**: se corrige el código o se actualiza esta base (pero siempre queda una sola verdad).
- Antes de proponer cambios, el agente debe:
  1) leer 00-index.md,
  2) leer 01-drako-overview.md,
  3) revisar 03-domains-routing.md + 05-data-model.md,
  4) y ejecutar el checklist de 15-release-gates.md.

> Objetivo: que puedas abrir un SaaS “por chat” y que todos los chats tengan exactamente la misma arquitectura, lenguaje y reglas.


**Fecha:** 2026-01-04

Este set de 20 archivos es la **fuente única de verdad** del proyecto (para que cualquier chat/IA trabaje alineado).

## Qué es qué
- **Campamento Base** (**base.drako.systems**) → el **holding/cerebro**: registry, dominios, economía, observabilidad, fábrica de SaaS.
- **Drako.Systems** (**drako.systems**) → el **primer SaaS** del holding (también operativo).
- **SaaS creados** → productos del holding:
  - canónico: **<saasSlug>.apps.drako.systems**
  - o dominio propio del cliente.

## Invariantes (no negociables)
1. **Repo único** (un solo `package.json` en la raíz).
2. Stack: **Next.js App Router + Cloudflare Pages + D1**.
3. APIs/rutas dinámicas relevantes: **Edge runtime**.
4. **Multi-tenant**: siempre hay `tenantId` (header/cookie/query). En dev: `demo-tenant`.
5. Registry real: **D1** (`saas`, `saas_projects`, `saas_domains`).
6. Nada de **500 silencioso**: errores previsibles ⇒ **503 con reason + hint**.
7. Seeds idempotentes obligatorios:
   - `campamento-base` + dominio `base.drako.systems` (ACTIVE/verified, primary)
   - `drako-systems` + dominio `drako.systems` (ACTIVE/verified, primary)

## Lectura obligatoria (para cualquier chat/IA)
1) `01-drako-overview.md`
2) `03-domains-routing.md`
3) `05-data-model.md`
4) `13-runbooks.md`
5) `15-release-gates.md`

## Lista de archivos (20)
Docs:
- 00-index.md
- 01-drako-overview.md
- 02-brand-system.md
- 03-domains-routing.md
- 04-billing-stripe.md
- 05-data-model.md
- 06-security.md
- 07-observability.md
- 08-onboarding.md
- 09-migration-pipeline.md
- 10-knowledge-bases.md
- 11-connectors.md
- 12-provisioning.md
- 13-runbooks.md
- 14-windsurf-workflow.md
- 15-release-gates.md

Schemas:
- drako-config.schema.json
- domain-mapping.schema.json
- campamento-kernel.schema.json
- import-job.schema.json

## Regla final
Si el código difiere de estos docs: **se alinea** (código o docs), pero nunca se ignora.