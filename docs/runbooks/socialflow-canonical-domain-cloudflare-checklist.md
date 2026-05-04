# Runbook - Cloudflare custom domain SocialFlow

Date: 2026-05-04  
Scope: manual operational checklist only  
Change class: no Cloudflare, DNS, worker, runtime, OAuth, data, or phase-gate mutation

## Objetivo

Crear y validar `socialflow.drako.systems` como dominio canonico de SocialFlow, apuntando a `saas-socialflows-prod`.

## Precondiciones

- Workflow `main` verde.
- Worker `saas-socialflows-prod` existe.
- `socialflows.drako.systems` sigue operativo como compat.
- Smoke manual P10.15 disponible:
  - `scripts/smoke/socialflow-canonical-domain-smoke.mjs`
  - `docs/runbooks/socialflow-canonical-domain-smoke.md`
- Phase gate `socialflowCanonicalDomain.active` sigue `false`.
- No hay cambios pendientes en git antes de ejecutar la operacion real.

## No tocar durante esta operacion

- Mentoria.
- Workers distintos a `saas-socialflows-prod`.
- Middleware.
- DBs.
- OAuth code.
- LinkedIn callbacks hasta fase especifica.
- Phase gate.

## Checklist manual Cloudflare

1. Entrar en Cloudflare.
2. Confirmar cuenta correcta del ecosistema Drako.
3. Confirmar zona correcta de `drako.systems`.
4. Ir al Worker `saas-socialflows-prod`.
5. Revisar dominios/custom domains actuales.
6. Confirmar si `socialflows.drako.systems` existe y sigue apuntando a `saas-socialflows-prod`.
7. Anadir custom domain `socialflow.drako.systems`.
8. Esperar certificado activo.
9. Confirmar que `socialflow.drako.systems` apunta al worker `saas-socialflows-prod`.
10. No eliminar `socialflows.drako.systems`.
11. No cambiar routes legacy.
12. Registrar evidencia:
    - captura o export del hostname;
    - worker service;
    - estado certificado;
    - timestamp;
    - operador responsable.

## Validacion HTTP manual

Ejecutar solo despues de que Cloudflare muestre certificado activo:

```bash
curl -I https://socialflow.drako.systems/
curl -I https://socialflow.drako.systems/socialflow
curl -I https://socialflow.drako.systems/socialflow/auth
curl -I https://socialflow.drako.systems/api/social/posts
curl -I https://socialflow.drako.systems/api/social/linkedin/publish
```

Resultados esperados:

- `/` responde `200` o `3xx` controlado.
- `/socialflow` responde `200` o `3xx` controlado.
- `/socialflow/auth` responde `200`.
- `/api/social/posts` responde `410`.
- `/api/social/linkedin/publish` responde `410`.

## Smoke manual

```bash
SOCIALFLOW_CANONICAL_SMOKE_ENABLED=1 SOCIALFLOW_CANONICAL_HOST=socialflow.drako.systems pnpm smoke:socialflow:canonical:manual
```

El smoke:

- es read-only;
- solo usa `GET`;
- no publica;
- no requiere secretos;
- valida rutas canonicas, legacy `410`, compat de `socialflows.drako.systems` y exposicion operator.

Si falla por callback OAuth no autorizado, registrar la evidencia como pendiente de fase OAuth. No cambiar LinkedIn durante esta operacion.

## OAuth LinkedIn

- No cambiar callbacks todavia.
- Antes del switch completo, anadir en LinkedIn Developer Console:
  - `https://socialflow.drako.systems/api/socialflow/linkedin/callback`
- Mantener callbacks legacy/plural hasta confirmar smokes.
- No retirar el bridge `/auth/linkedin/callback`.
- No retirar bridges `/api/social/linkedin/connect` ni `/api/social/linkedin/callback`.

## Rollback

Si el custom domain falla:

1. Retirar solo `socialflow.drako.systems`.
2. Mantener `socialflows.drako.systems`.
3. No tocar DB.
4. No tocar worker code.
5. No activar phase gate.
6. Registrar incidente con:
   - hostname afectado;
   - worker observado;
   - estado certificado;
   - respuestas HTTP;
   - hora de inicio/fin;
   - decision tomada.

## Criterios de exito

- `socialflow.drako.systems` resuelve.
- Certificado activo.
- Hostname apunta a `saas-socialflows-prod`.
- Smoke manual pasa o falla solo por riesgo OAuth documentado.
- Legacy `410` sigue activo.
- `socialflows.drako.systems` sigue operativo.
- No hay cambios de codigo.
- Phase gate sigue inactivo hasta la fase readiness acordada.

## Criterios para NO avanzar

- Worker incorrecto.
- Certificado pendiente demasiado tiempo.
- `/api/social/posts` no devuelve `410`.
- `/api/social/linkedin/publish` no devuelve `410`.
- OAuth connect genera callback inesperado.
- Operator queda expuesto sin auth.
- Cualquier senal de datos productivos afectados.
- Cualquier cambio accidental en DNS, routes, workers, DBs, middleware, OAuth code o phase gate.

## Evidencia a adjuntar al cierre operativo

- Captura/export de Cloudflare Custom Domain.
- Resultado de `curl -I` de rutas criticas.
- Salida completa del smoke manual.
- Confirmacion de `socialflows.drako.systems` como compat.
- Confirmacion de `phaseGates.socialflowCanonicalDomain.active: false`.
