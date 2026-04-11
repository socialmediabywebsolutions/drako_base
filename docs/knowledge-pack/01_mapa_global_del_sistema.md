# 01_mapa_global_del_sistema

## Qué es
Documento de topología global del ecosistema SaaS Drako en runtime real (Next.js + OpenNext + Cloudflare Workers), con separación explícita entre marca, operador interno y productos.

## Para qué sirve
- Alinear arquitectura entre producto, plataforma y operación.
- Evitar mezcla de contextos (marca, operator, SaaS cliente).
- Servir como referencia de onboarding técnico y de hardening de boundaries.

## Qué soluciona
- Ambigüedad entre Drako (marca) y productos SaaS.
- Confusión entre Campamento Base (control plane) y superficies de usuario final.
- Errores de enrutado y auth cross-product.

## Cómo se comporta

### 1) Capas canónicas
1. **Marca central (Drako)**
   - Identidad corporativa y paraguas de portafolio.
   - No es un workspace de cliente final.
2. **Campamento Base (operador interno)**
   - Capa de control plane y operación interna.
   - Superficies `operator/*`, gobernanza, catálogo, observabilidad.
3. **SaaS verticales**
   - **Mentoría**: educación + onboarding familiar + workspace.
   - **SocialFlow**: automatización social + auth aislada + workspace.
4. **Fábrica SaaS (futuro)**
   - Provisioning y creación de nuevas líneas SaaS.

### 2) Entradas de ejecución
- `src/middleware.ts` como puerta de control principal.
- `src/app/api/*/route.ts` como superficie API efectiva.
- `.open-next/worker.js` como entry runtime productivo en Workers.

### 3) Espacios de nombres relevantes
- `src/lib/campamento-base/*` = núcleo canónico de control plane.
- `src/lib/campobase/*` = capa operacional existente (no sustituye el núcleo).

### 4) Matriz rápida de dominios funcionales
- **Drako marca**: narrativa, producto, catálogo, front público.
- **Campamento Base**: control operacional interno, no flujo de tenant final.
- **Mentoría**: auth aislada + onboarding + app del producto.
- **SocialFlow**: auth aislada + workspace social + operator social.

## Qué NO debe hacer
- No tratar Drako como producto SaaS de tenant.
- No mezclar auth/session entre productos aislados.
- No exponer rutas operator en host/superficie pública de SaaS.
- No enrutar por bypass fuera de middleware + App Router.
