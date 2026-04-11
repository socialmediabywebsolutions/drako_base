# 07_mentoria_saas_flujo_completo

## Qué es
Especificación end-to-end del SaaS Mentoría: entrada pública, auth aislada, onboarding y workspace de aplicación.

## Para qué sirve
- Garantizar consistencia de flujo desde landing hasta app.
- Documentar contratos de rutas y boundaries de auth.
- Evitar regresiones en CTAs, redirects y onboarding.

## Qué soluciona
- Rutas legacy (`/signup`) y hardcodes incorrectos de localhost.
- Ambigüedad entre rutas de marketing y rutas de producto.
- Fallos de aislamiento entre contexto de auth y contexto de app.

## Cómo se comporta

### 1) Entradas públicas de landing
Landings activas:
- `src/app/site/mentoria/page.tsx`
- `src/app/site/mentoria-es/page.tsx`
- `src/app/site/mentoria-mx/page.tsx`
- `src/app/site/mentoria-ar/page.tsx`
- `src/app/site/mentoria-cl/page.tsx`
- `src/app/site/mentoria-co/page.tsx`

Rutas de entrada normalizadas:
- Registro: `/mentorias/auths/registrations`
- Login: `/mentorias/auths/logins`

### 2) Autenticación aislada Mentoría
UI:
- `src/app/mentorias/auths/registrations/page.tsx`
- `src/app/mentorias/auths/logins/page.tsx`

API:
- `src/app/api/mentorias/auths/registrations/route.ts`
- `src/app/api/mentorias/auths/logins/route.ts`

Comportamiento:
- `enforceAuthBoundary(... expectedContext: "mentorias")`.
- Registro crea identidad y sesión en contexto Mentoría.
- Se emite cookie con `setAuthsSessionCookie({ context: "mentorias" })`.

### 3) Flujo de registro real
1. Usuario entra por landing y pulsa CTA principal.
2. Llega a `/mentorias/auths/registrations`.
3. POST a `/api/mentorias/auths/registrations` valida input y contexto.
4. Se resuelve familia/tenant vía `MentoriaFamilyService`.
5. Se registra usuario en `mentoriasAuths.register(...)`.
6. Se ejecuta `finalizeRegistration(...)`.
7. Se hace login automático y emisión de sesión.
8. Redirect post-login a `/mentoria/onboarding`.

### 4) Flujo de login real
1. Usuario entra por `/mentorias/auths/logins`.
2. POST a `/api/mentorias/auths/logins`.
3. Se valida boundary/contexto.
4. Login exitoso devuelve role/tenant/family bundle.
5. Cookie de sesión contextuada.
6. Redirect post-login a `/mentoria/onboarding`.

### 5) Onboarding y app
- Onboarding route: `src/app/mentoria/onboarding/page.tsx`
- App route: `src/app/mentoria/app/page.tsx`
- Middleware en host Mentoria:
  - `/onboarding*` -> `/mentoria/onboarding*`
  - `/app*` -> `/mentoria/app*`

### 6) Reglas de UI de landing
- "Ver módulos" se alinea a entrada real de login (`/mentorias/auths/logins`) para coherencia de acceso.
- Bloque "Neural Dashboard" es decorativo en landings y se mantiene no interactivo.

## Qué NO debe hacer
- No volver a usar `/signup` legacy en CTAs públicos.
- No apuntar a `https://localhost` desde landings.
- No saltar `enforceAuthBoundary` en endpoints Mentoría.
- No mezclar sesión Mentoría con otras superficies de auth.
