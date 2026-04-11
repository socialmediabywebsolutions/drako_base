# 09_fabrica_saas_estado_futuro

## Qué es
Marco técnico de la Fábrica SaaS como capacidad de creación/provisioning de nuevos productos en el ecosistema.

## Para qué sirve
- Definir dirección de evolución sin mezclarla con runtime estable actual.
- Documentar límites entre estado actual y estado objetivo.
- Establecer criterios de integración con Campamento Base.

## Qué soluciona
- Expectativas incorrectas de features aún no terminadas.
- Integraciones prematuras con rutas o servicios incompletos.
- Acoplamiento entre roadmap y superficies productivas activas.

## Cómo se comporta

### 1) Estado actual
- Existe visión y piezas de wiring de factory en documentación y módulos operator.
- Runtime productivo canónico sigue centrado en Next.js + middleware + OpenNext.
- La Fábrica no sustituye los flujos productivos actuales de Mentoría/SocialFlow.

### 2) Estado objetivo
- Blueprinting de nuevos SaaS con contratos claros.
- Provisioning controlado (dominio, billing, configuración inicial, políticas de auth).
- Registro automático en control plane y observabilidad.

### 3) Integración esperada
- Campamento Base coordina creación y gobernanza.
- Cada SaaS creado debe nacer con frontera auth aislada y rutas explícitas.
- Middleware debe reconocer host/contexto del nuevo SaaS sin romper fronteras existentes.

### 4) Requisitos de hardening antes de GA
- Idempotencia robusta en provisioning.
- Estados de máquina de fábrica cerrados y auditables.
- Contratos de rollback y recuperación ante fallos.
- Pruebas de aislamiento multitenant por producto generado.

## Qué NO debe hacer
- No presentarse como finalizada mientras siga en estado de evolución.
- No crear SaaS nuevos sin definir boundary de auth y tenancy.
- No saltar controles de Campamento Base por despliegues rápidos.
- No degradar rutas existentes para habilitar fábrica parcial.
