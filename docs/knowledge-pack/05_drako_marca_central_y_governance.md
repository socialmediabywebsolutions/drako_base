# 05_drako_marca_central_y_governance

## Qué es
Definición de Drako como marca central y capa de gobernanza del ecosistema, no como producto SaaS único.

## Para qué sirve
- Delimitar responsabilidades de identidad, catálogo y estrategia.
- Evitar acoplamiento indebido entre marca y ejecución de producto.
- Alinear decisiones de naming, routing y ownership.

## Qué soluciona
- Confusión entre brand-level y product-level.
- Sobrecarga de rutas centrales con lógica de tenant específica.
- Derivas de arquitectura sin control de fronteras.

## Cómo se comporta

### 1) Rol central
- Drako agrupa portafolio de SaaS y operator surfaces.
- Define estándares transversales (auth isolation, tenancy, observabilidad, despliegue).

### 2) Rol de governance técnica
- El control de acceso y boundaries se aplica en middleware + APIs.
- El runtime productivo está centralizado en OpenNext Worker.
- Campamento Base opera como control plane interno, no como "marca pública".

### 3) Principios de portafolio
- Cada SaaS conserva identidad funcional y frontera auth propia.
- Los flujos de negocio no deben depender de hardcodes de marca.
- Las rutas públicas deben resolver a entrypoints de cada producto, no a alias ambiguos.

### 4) Guardrails de nomenclatura
- Campamento Base (control plane) y campobase (namespace técnico operacional) se distinguen explícitamente.
- Evitar términos ambiguos en código y documentación de arquitectura.

## Qué NO debe hacer
- No actuar como tenant o workspace de cliente final.
- No concentrar auth productiva de todos los SaaS en una ruta genérica sin contexto.
- No romper separación de productos por acelerar entregas puntuales.
- No mover decisiones de governance fuera de contratos y auditorías técnicas.
