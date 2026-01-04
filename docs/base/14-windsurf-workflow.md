# Workflow (para evitar caos)

## Regla 0 — Repo único
- Un solo `package.json` en raíz.
- Nada de carpetas duplicadas del proyecto.

## Regla 1 — Validación obligatoria
Antes de decir “listo”:
- `npm run qa` ✅
- `npm run cf:build` ✅
Si toca D1/routing:
- `npm run cf:preview` + curl ✅

## Regla 2 — Cloudflare manda
- Edge runtime donde toca.
- No meter SSR incompatible con Pages runtime.

## Regla 3 — Registry manda
- Si no está en D1, no existe.
- /api/health y /api/saas deben reflejarlo.

## Regla 4 — Errores observables
- Sin 500 silencioso.
- 503 reason + hint SIEMPRE.

## Regla 0: esta base manda

Antes de tocar código, cualquier agente debe:

1) leer 00-index.md + 01-drako-overview.md,
2) validar dominios/routing con 03-domains-routing.md,
3) validar datos con 05-data-model.md,
4) y ejecutar gates de 15-release-gates.md.

Si el código no refleja esta base, el trabajo empieza por **alinear** (docs ↔ código ↔ Cloudflare).
