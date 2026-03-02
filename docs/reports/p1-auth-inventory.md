# P1 Auth Inventory

## Tabla de superficies (registro/login/auth/redirects)
| Ruta | Archivo | Tipo | SaaS objetivo | Destino final |
| --- | --- | --- | --- | --- |
| `/api/auth/[...nextauth]` | `src/app/api/auth/[...nextauth]/route.ts` | `route` | `drako` | `/api/auth/[...nextauth]` |
| `/api/auth/login` | `src/app/api/auth/login/route.ts` | `route` | `drako` | `/api/auth/login` |
| `/api/auth/register` | `src/app/api/auth/register/route.ts` | `route` | `drako` | `/api/auth/register` |
| `/api/bases/auths/logins` | `src/app/api/bases/auths/logins/route.ts` | `route` | `campo_base` | `/api/bases/auths/logins` |
| `/api/bases/auths/logouts` | `src/app/api/bases/auths/logouts/route.ts` | `route` | `campo_base` | `/api/bases/auths/logouts` |
| `/api/bases/auths/registrations` | `src/app/api/bases/auths/registrations/route.ts` | `route` | `campo_base` | `/api/bases/auths/registrations` |
| `/api/bases/telemetries/events` | `src/app/api/bases/telemetries/events/route.ts` | `route` | `campo_base` | `/api/bases/telemetries/events` |
| `/api/drakos/auths/logins` | `src/app/api/drakos/auths/logins/route.ts` | `route` | `drako` | `/api/drakos/auths/logins` |
| `/api/drakos/auths/logouts` | `src/app/api/drakos/auths/logouts/route.ts` | `route` | `drako` | `/api/drakos/auths/logouts` |
| `/api/drakos/auths/registrations` | `src/app/api/drakos/auths/registrations/route.ts` | `route` | `drako` | `/api/drakos/auths/registrations` |
| `/api/mentorias/auths/logins` | `src/app/api/mentorias/auths/logins/route.ts` | `route` | `mentorias` | `/api/mentorias/auths/logins` |
| `/api/mentorias/auths/logouts` | `src/app/api/mentorias/auths/logouts/route.ts` | `route` | `mentorias` | `/api/mentorias/auths/logouts` |
| `/api/mentorias/auths/registrations` | `src/app/api/mentorias/auths/registrations/route.ts` | `route` | `mentorias` | `/api/mentorias/auths/registrations` |
| `/auth/login` | `src/app/auth/login/page.tsx` | `page` | `unknown` | `/auth/login` |
| `/auth/register` | `src/app/auth/register/page.tsx` | `page` | `unknown` | `/auth/login` |
| `/auth/register` | `src/app/auth/register/page.tsx` | `page` | `unknown` | `/auth/register` |
| `/drakos/auths/logins` | `src/app/drakos/auths/logins/page.tsx` | `page` | `drako` | `/auth/login` |
| `/drakos/auths/logins` | `src/app/drakos/auths/logins/page.tsx` | `page` | `drako` | `/drakos/auths/logins` |
| `/drakos/auths/registrations` | `src/app/drakos/auths/registrations/page.tsx` | `page` | `drako` | `/auth/register` |
| `/drakos/auths/registrations` | `src/app/drakos/auths/registrations/page.tsx` | `page` | `drako` | `/drakos/auths/registrations` |
| `/mentorias/auths/logins` | `src/app/mentorias/auths/logins/page.tsx` | `page` | `mentorias` | `/mentorias/auths/logins` |
| `/mentorias/auths/registrations` | `src/app/mentorias/auths/registrations/page.tsx` | `page` | `mentorias` | `/mentorias/auths/registrations` |
| `/site/mentoria-ar` | `src/app/site/mentoria-ar/page.tsx` | `page` | `mentorias` | `/site/mentoria-ar/signup` |
| `/site/mentoria-cl` | `src/app/site/mentoria-cl/page.tsx` | `page` | `mentorias` | `/site/mentoria-cl/signup` |
| `/site/mentoria-co` | `src/app/site/mentoria-co/page.tsx` | `page` | `mentorias` | `/site/mentoria-co/signup` |
| `/site/mentoria-es` | `src/app/site/mentoria-es/page.tsx` | `page` | `mentorias` | `/site/mentoria-es/signup` |
| `/site/mentoria-mx` | `src/app/site/mentoria-mx/page.tsx` | `page` | `mentorias` | `/site/mentoria-mx/signup` |
| `/site/mentoria` | `src/app/site/mentoria/page.tsx` | `page` | `mentorias` | `/site/mentoria/signup` |
| `/site/mentoria/signup` | `src/app/site/mentoria/signup/page.tsx` | `page` | `mentorias` | `/api/mentorias/auths/registrations` |
| `/site/mentoria/signup` | `src/app/site/mentoria/signup/page.tsx` | `page` | `mentorias` | `/site/mentoria/signup` |
| `/src/components/auth/auth-form.tsx` | `src/components/auth/auth-form.tsx` | `component` | `drako` | `/src/components/auth/auth-form.tsx` |
| `/src/components/auth/auth-form.tsx` | `src/components/auth/auth-form.tsx` | `component` | `drako` | `${authApiBase}/logins` |
| `/src/components/home/HomePage.tsx` | `src/components/home/HomePage.tsx` | `component` | `unknown` | `/auth/register` |
| `/src/lib/auth/crypto.ts` | `src/lib/auth/crypto.ts` | `other` | `drako` | `/src/lib/auth/crypto.ts` |
| `/src/lib/auth/session.test.ts` | `src/lib/auth/session.test.ts` | `other` | `drako` | `/src/lib/auth/session.test.ts` |
| `/src/lib/auth/session.ts` | `src/lib/auth/session.ts` | `other` | `drako` | `/src/lib/auth/session.ts` |
| `/(middleware)` | `src/middleware.ts` | `middleware` | `unknown` | `/auth/login` |
| `/(middleware)` | `src/middleware.ts` | `middleware` | `unknown` | `/mentorias/auths/logins` |
| `/(middleware)` | `src/middleware.ts` | `middleware` | `unknown` | `/mentorias/auths/registrations` |

## Redirects cruzados detectados
- Ninguno.

## Endpoints API auth por vertical
### drakos
- `/api/drakos/auths/logins` — `src/app/api/drakos/auths/logins/route.ts`
- `/api/drakos/auths/logouts` — `src/app/api/drakos/auths/logouts/route.ts`
- `/api/drakos/auths/registrations` — `src/app/api/drakos/auths/registrations/route.ts`
### mentorias
- `/api/mentorias/auths/logins` — `src/app/api/mentorias/auths/logins/route.ts`
- `/api/mentorias/auths/logouts` — `src/app/api/mentorias/auths/logouts/route.ts`
- `/api/mentorias/auths/registrations` — `src/app/api/mentorias/auths/registrations/route.ts`
### bases
- `/api/bases/auths/logins` — `src/app/api/bases/auths/logins/route.ts`
- `/api/bases/auths/logouts` — `src/app/api/bases/auths/logouts/route.ts`
- `/api/bases/auths/registrations` — `src/app/api/bases/auths/registrations/route.ts`
### legacy
- Ninguno.
