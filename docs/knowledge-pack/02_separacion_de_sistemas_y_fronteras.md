# 02_separacion_de_sistemas_y_fronteras

## Qué es
Especificación de fronteras de aislamiento entre marca, operador interno y productos SaaS del ecosistema.

## Para qué sirve
- Definir contratos de acceso por contexto.
- Reducir riesgo de cross-tenant y cross-product.
- Estandarizar decisiones de routing y auth.

## Qué soluciona
- Fugas de rutas entre host operador y host SaaS.
- Uso de endpoints de auth fuera de contexto.
- Dependencias indebidas entre dominios de negocio.

## Cómo se comporta

### 1) Frontera Drako vs Campamento Base
- **Drako**: capa de marca y portafolio.
- **Campamento Base**: operación interna y control plane.
- Regla: la marca no debe asumir privilegios operator por defecto.

### 2) Frontera Campamento Base vs SaaS cliente
- `src/middleware.ts` bloquea auth final-user en host base y evita que rutas de producto se consuman en contexto incorrecto.
- En host admin/base, auth final-user (`/api/drakos/auths/*`, `/api/mentorias/auths/*`, `/api/socialflow/auths/*`) se rechaza con `403`.

### 3) Frontera Mentoría vs SocialFlow
- Contextos de auth separados:
  - Mentoría: `/api/mentorias/auths/*`
  - SocialFlow: `/api/socialflow/auths/*`
- `enforceAuthBoundary(...)` en endpoints de auth impone expected context.
- Cookies de sesión se emiten por contexto (`setAuthsSessionCookie`).

### 4) Frontera operator route vs public route
- Prefijos administrativos (`/admin`, `/operator`, `/metrics`, `/alerts`, etc.) no son válidos en host público; middleware redirige.
- Rutas de tenant workspace se permiten con headers de contexto (`x-drako-client-entry-mode`, `x-drako-client-workspace-kind`).

### 5) Frontera namespace técnico
- `campamento-base` (núcleo) y `campobase` (operacional) coexisten con propósito distinto.
- No sustituir ni fusionar sin auditoría explícita.

## Qué NO debe hacer
- No usar rutas de auth de Mentoría desde SocialFlow ni viceversa.
- No exponer control plane en superficies cliente.
- No eliminar fronteras de middleware para "facilitar" desarrollo local.
- No introducir aliases ambiguos de namespaces sin contrato de migración.
