# 14_debug_playbook

## Objetivo de este archivo
Playbook operativo para depurar problemas reales del flujo Mentoría con foco en drift entre runtime, middleware y DB.

## Alcance
Aplicable a incidentes y regresiones en:
- landings Mentoría,
- rutas auth Mentoría,
- onboarding/workspace,
- inconsistencias tenant/family,
- diferencias `:3000` vs `:8787`.

## Principio rector
**No cerrar debugging sin reproducir en `wrangler dev --local` (`:8787`) cuando el problema toca middleware/auth/DB.**

---

## 1) Triaging rápido (5-10 min)

### 1.1 Identificar tipo de fallo
Clasificar primero:
- `RUNTIME_DRIFT`: funciona en `:3000`, falla en `:8787`.
- `MIDDLEWARE_DRIFT`: ruta/redirect/rewrite inesperado.
- `DB_DRIFT`: error en bindings, tenant, familia o persistencia.
- `MIXED_DRIFT`: combinación de los tres.

### 1.2 Capturar evidencia mínima
Registrar en ticket/log:
- URL exacta inicial y final.
- Host usado.
- Método HTTP y endpoint si aplica.
- Código de estado y payload de error.
- Si fue `:3000` o `:8787`.

### 1.3 Definir impacto de negocio
- ¿Bloquea registro?
- ¿Bloquea login?
- ¿Bloquea onboarding?
- ¿Crea sesión inconsistente con tenant/family?

---

## 2) Ruta de diagnóstico por capas

## 2.1 Capa runtime
Objetivo: confirmar paridad de ejecución.

Pasos:
1. Ejecutar en `:3000` y documentar comportamiento.
2. Ejecutar en `:8787` y comparar.
3. Si difiere, etiquetar como `RUNTIME_DRIFT`.

Señales típicas:
- Redirect distinto.
- Headers/context no presentes.
- Cookies/sesión no emitidas igual.

Acción inmediata:
- Continuar diagnóstico en `:8787` como fuente de verdad.

## 2.2 Capa middleware
Objetivo: validar decisión de enrutado y boundary.

Puntos a revisar:
- Regla de entrada para host Mentoría (`/`, `/app`, `/onboarding`, `/signup`, `/login`, `/auth/*`).
- Bloqueos por host base/admin en auth final-user.
- Headers de contexto agregados en API routes.

Preguntas de control:
- ¿El path original debería reescribirse o redirigirse?
- ¿La regla actual coincide con expected context de Mentoría?
- ¿Hay colisión con reglas legacy de operator/workspace?

Salida esperada:
- Tabla `path_in -> action (rewrite|redirect|next) -> path_out`.

## 2.3 Capa DB
Objetivo: confirmar consistencia de bindings y estado familiar.

Puntos a revisar en registro Mentoría:
- Disponibilidad de bindings (`MENTORIA_DB` o `DRACO_DB`).
- Resultado de `resolveRegistrationFamily`.
- Éxito/fallo de `finalizeRegistration`.
- Coherencia entre `tenantId` de login y `familyBundle`.

Puntos a revisar en login Mentoría:
- Respuesta incluye `family`, `guardians`, `students`.
- `tenantId` y `role` compatibles con el bundle.

Salida esperada:
- Confirmación de integridad de sesión + contexto familiar.

---

## 3) Flujos críticos a validar siempre (Mentoría)

### FLUJO-A — Landing -> Registration -> Onboarding
1. Entrar por landing regional o principal.
2. CTA principal a `/mentorias/auths/registrations`.
3. Registrar usuario válido.
4. Confirmar sesión emitida.
5. Confirmar redirect a `/mentoria/onboarding`.

### FLUJO-B — Landing -> Login -> Onboarding
1. Entrar por landing.
2. CTA de acceso/módulos a `/mentorias/auths/logins`.
3. Login con cuenta existente.
4. Confirmar bundle familiar en respuesta.
5. Confirmar acceso coherente a onboarding.

### FLUJO-C — Legacy path compatibility
1. Invocar `/signup` en contexto host Mentoría.
2. Confirmar `308` a `/mentorias/auths/registrations`.
3. Completar registro y validar continuidad.

---

## 4) Matriz de síntomas -> causa probable

- Síntoma: loop o redirect inesperado
  - Causa probable: regla middleware en conflicto por host/path.
- Síntoma: `403` en auth endpoint
  - Causa probable: boundary/context incorrecto o host bloqueado.
- Síntoma: `503` o DB unavailable
  - Causa probable: bindings no resueltos en runtime actual.
- Síntoma: login OK pero onboarding inconsistente
  - Causa probable: drift tenant/family entre auth y DB.
- Síntoma: funciona en `:3000` y falla en `:8787`
  - Causa probable: dependencia de comportamiento no-edge o falta de contexto host.

---

## 5) Protocolo de fix (orden obligatorio)
1. Reproducir y capturar evidencia.
2. Determinar capa primaria (runtime/middleware/DB).
3. Aplicar fix mínimo en la capa correcta (no workaround transversal).
4. Revalidar los 3 flujos críticos en `:8787`.
5. Registrar resultado en `13_progress_log.md`.
6. Actualizar estado de issue en `12_open_issues.md`.

---

## 6) Criterio de "resuelto"
Un bug de Mentoría se considera resuelto solo si:
- no reproduce en `:8787`,
- no rompe flujos A/B/C,
- mantiene boundaries de auth,
- mantiene consistencia tenant/family en DB,
- queda trazado en progress log + open issues.

---

## 7) Plantilla de reporte de incidente
Usar esta plantilla en cada depuración:

```
INCIDENT_ID:
Severidad:
Flujo afectado:
Entorno(s): 3000 / 8787
Path entrada:
Path final observado:
Respuesta HTTP:
Capa primaria: runtime|middleware|db
Causa raíz:
Fix aplicado:
Verificación 8787:
Riesgo residual:
Issue relacionado:
Log entry creado en 13_progress_log: sí/no
```

---

## 8) Anti-patrones prohibidos
- Cerrar bug porque "en 3000 funciona".
- Corregir DB sin validar middleware/host context.
- Corregir middleware sin validar persistencia y sesión final.
- Dejar fixes sin trazabilidad en `12` y `13`.
- Resolver con hardcodes de localhost en rutas públicas.
