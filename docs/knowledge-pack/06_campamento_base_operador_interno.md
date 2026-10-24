# 06_campamento_base_operador_interno

## Qué es
Campamento Base es la capa interna de operación y control plane del ecosistema Drako.

## Para qué sirve
- Coordinar economía operativa, pricing, vendor, tesorería y observabilidad del portafolio.
- Gestionar catálogo y evolución operativa de SaaS.
- Proveer superficies administrativas para operación central.

## Qué soluciona
- Falta de control unificado sobre múltiples SaaS.
- Decisiones descoordinadas entre pricing, costos e impacto operativo.
- Ausencia de plano de mando para acciones globales.

## Cómo se comporta

### 1) Responsabilidades principales
- Economía/holding y telemetría operativa.
- Gobernanza de módulos y flujos operator.
- Integración con eventos de plataforma (`recordCampamentoEvent`).

### 2) Superficies clave
- Rutas operator/admin (`/operator/*`, bloques administrativos).
- Endpoints y capas de control para automatización y monitoreo.

### 3) Separación con productos
- Campamento Base no reemplaza workspaces de producto (Mentoría/SocialFlow).
- No expone auth final-user en host base cuando boundaries están activos.

### 4) Namespaces técnicos
- Núcleo: `src/lib/campamento-base/*`.
- Capa operacional existente: `src/lib/campobase/*`.
- Ambos conviven con responsabilidades distintas.

### 5) Estado de fábrica
- Existe visión y wiring para SaaS Factory (blueprints/provisioning), con componentes en evolución.

## Qué NO debe hacer
- No servir como acceso directo de usuarios finales de SaaS.
- No mezclar sesiones de operador con sesiones tenant finales.
- No invadir dominios funcionales de producto sin contrato explícito.
- No eliminar diferencias entre `campamento-base` y `campobase` sin auditoría.
