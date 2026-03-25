# Drako Runtime Model

## 1. Visión general

Drako es una plataforma multi-SaaS con dos responsabilidades simultáneas:

- operar SaaS reales sobre una base compartida
- permitir que nuevos SaaS nazcan y se conecten al sistema sin wiring ad hoc

En su estado actual, Drako funciona como:

- **fábrica de SaaS**
  - crea SaaS en runtime usando contrato y registro
- **sistema operativo de ejecución**
  - ejecuta automations, integraciones, observabilidad y señales transversales

Las capas principales son:

- **Contract Layer**
  - define cómo un SaaS se describe y cómo se conecta
- **Factory**
  - crea SaaS en runtime, los registra y gobierna su lifecycle básico
- **Runtime SaaS**
  - instancia operativa de un SaaS por `tenantId + saasId`
- **Execution Layer**
  - permite señales, routing y ejecución transversal entre SaaS
- **Control Plane**
  - expone estado, lifecycle y actividad del ecosistema

Drako no es una colección de SaaS aislados con utilidades compartidas. Es un runtime común con contratos explícitos.

## 2. Modelo de SaaS en Drako

### Platform Definition

La `Platform Definition` describe un SaaS de forma estática.

Contiene:

- `saasId`
- `displayName`
- `category` opcional
- `supportsOperatorSurface`
- `automations`
- `integrations`
- `matchesSaasId` opcional cuando un SaaS necesita resolver variantes

No contiene:

- `tenantId`
- estado runtime
- handlers
- providers
- credenciales
- wiring con otros módulos

La definición describe qué es el SaaS y qué declara. No ejecuta nada.

### Platform Bootstrap

El `Platform Bootstrap` conecta el SaaS al runtime.

Contiene:

- `connect(context)`
- `signalHandlers` opcionales

En el bootstrap se conectan:

- automations reales
- integrations reales
- handlers reales
- wiring con los cores compartidos

El bootstrap conecta. No define identidad estática ni contiene el estado de un tenant.

### Runtime

El runtime se resuelve con:

- `resolveSaasPlatform(saasId)`
- `loadPlatformForSaas(tenantId, saasId)`

`loadPlatformForSaas(...)` hace lo siguiente:

1. resuelve la definición y bootstrap del SaaS
2. ejecuta `bootstrap.connect({ tenantId, saasId })`
3. deja al SaaS operativo dentro del runtime común

Esto evita acoplamiento a wiring manual o listas estáticas repartidas por el sistema.

## 3. Nacimiento de un SaaS

El flujo real actual de nacimiento es:

1. se llama a `createSaasInstance(...)`
2. se construye una `SaasPlatformDefinition`
3. se construye una `SaasPlatformBootstrap`
4. se registran ambos en el Contract Layer
5. se registra el SaaS en el Factory Registry
6. el SaaS queda con estado inicial `ACTIVE`

Características importantes:

- no se generan archivos
- no se toca el filesystem
- no se scaffolda código en disco
- todo ocurre en runtime

El Factory Orchestrator actual es lógico, no generativo. Crea presencia operativa estándar en Drako.

## 4. Factory Registry y Control Plane

### Factory Registry

El `Factory Registry` persiste los SaaS creados por la factory.

Guarda:

- `saasId`
- `displayName`
- `template`
- `status`
- `createdAt`
- `updatedAt`
- `createdBy` opcional
- `supportsOperatorSurface`
- `metadata` ligera

Estados lifecycle actuales:

- `ACTIVE`
- `DISABLED`
- `DEGRADED`
- `ARCHIVED`

El registry recuerda qué SaaS existen y en qué estado administrativo están. No ejecuta lógica del SaaS.

### Control Plane

El `Factory Control Plane` gobierna y compone visibilidad básica sobre los SaaS registrados.

Hace:

- listar SaaS
- consultar un SaaS
- cambiar estado lifecycle
- archivar
- exponer resumen operativo si existe
- exponer actividad reciente si existe
- exponer participación en execution layer

Consume:

- Factory Registry
- Observability Core
- Contract Layer

No duplica ejecución, ni inventa un modelo alternativo de actividad.

## 5. Automation e Integration

### Automations

Cada SaaS declara automations en su `Platform Definition`.

Cada automation declarada contiene:

- `automationKey`
- `displayName`
- `enabledByDefault`
- `description` opcional

La ejecución real siempre pasa por `Automation Core`, que centraliza:

- registry
- enable / disable
- trigger
- execution lifecycle
- execution history
- observabilidad de ejecución

El SaaS no debería ejecutar automations por fuera del core.

### Integrations

Cada SaaS declara integraciones en su `Platform Definition`.

Cada integración declarada contiene:

- `integrationKey`
- `required`
- `description` opcional

La conexión real y la ejecución de operaciones pasan por `Integration Core`, que centraliza:

- definitions
- connections
- credentials
- validate
- execute operation
- normalización de errores
- observabilidad de integración

Ejemplo actual:

- `whatsapp` ya existe como provider reusable
- un SaaS puede declararlo y consumirlo sin implementar su propia capa de conexión

## 6. Cross-SaaS Execution Layer

### Signals

Una `signal` es una señal agnóstica de negocio emitida por un SaaS para que otros SaaS reaccionen sin acoplamiento directo.

Estructura base actual:

- `signalId`
- `type`
- `sourceSaasId`
- `sourceTenantId`
- `payload`
- `createdAt`
- `correlationId`
- `chainDepth`

La señal no contiene decisión de negocio. Solo identidad, contexto y payload.

### Signal Bus

El `Signal Bus` actual es un bus mínimo en proceso.

Responsabilidades:

- recibir una señal
- enrutar por `type`
- ejecutar handlers registrados
- registrar actividad e incidentes asociados

No hace:

- colas externas
- routing complejo
- persistencia compleja de signals
- planificación de workflows
- decisiones de negocio

El bus enruta y ejecuta. No orquesta el negocio.

### Signal Handlers

Los `signalHandlers` se definen en `Platform Bootstrap`.

Eso implica:

- el SaaS declara capacidades en definition
- el SaaS conecta handlers reales en bootstrap
- el runtime ejecuta esos handlers cuando llega una señal compatible

Los SaaS no se llaman entre sí directamente. Reaccionan a señales bajo contrato común.

### Hardening actual

La capa actual ya incorpora hardening mínimo:

- **dedupe**
  - evita procesar dos veces una señal con el mismo `signalId`
- **chainDepth**
  - cada señal lleva profundidad de chaining
- **loop protection**
  - el bus corta señales que exceden el límite permitido
- **aislamiento de errores**
  - un handler roto o inválido no rompe el bus completo
- **trazabilidad**
  - `signalId`, `correlationId`, `originSignalId`, `chainDepth` y `targetSaasId` quedan expuestos en observability

Esto sigue siendo una capa mínima de comunicación entre sistemas. No es un workflow engine.

## 7. Observabilidad

La observabilidad operativa de Drako se apoya en `Observability Core`.

Eventos relevantes registrados hoy:

- `signal_emitted`
- `signal_handled`
- `signal_deduped`
- `signal_dropped`
- `automation_execution`

Además:

- fallos relevantes abren incidentes
- recuperaciones resuelven incidentes equivalentes

Estos datos se consumen desde:

- `Factory Control Plane`
- `Platform Operator Control Surface`

El objetivo no es logging infinito. El objetivo es trazabilidad operativa suficiente para operar el ecosistema.

## 8. Ejemplo real: `task.overdue`

El flujo real validado de extremo a extremo es:

1. un SaaS origen emite `task.overdue`
2. el `Signal Bus` registra `signal_emitted`
3. el bus busca todos los bootstraps con handler para `task.overdue`
4. `TaskOps` tiene un `signalHandler` para ese tipo
5. el handler de `TaskOps` dispara `taskops.pending_task_audit` vía `Automation Core`
6. la automation se ejecuta
7. `Automation Core` registra `automation_execution`
8. el bus registra `signal_handled`
9. `Observability Core` conserva la actividad resultante
10. el `Factory Control Plane` la expone como actividad cruzada reciente

Resultado:

- la señal se emite
- el routing ocurre
- el handler reacciona
- la automation corre
- la observabilidad queda registrada
- el control plane lo puede mostrar

Este flujo demuestra que Drako ya coordina SaaS distintos dentro de un runtime común.

## 9. Principios de diseño

Estas reglas deben mantenerse para evitar deriva arquitectónica:

- **No acoplar SaaS entre sí directamente**
  - la coordinación transversal debe pasar por signals y handlers registrados
- **No meter lógica en `Platform Definition`**
  - la definition describe; no ejecuta
- **Bootstrap conecta, no define negocio**
  - su trabajo es wiring con runtime y cores
- **El signal bus enruta, no decide negocio**
  - no debe convertirse en motor oculto de reglas
- **Los cores ejecutan y centralizan**
  - no duplicar automation, integration u observability dentro de cada SaaS
- **No generar código en disco para crear SaaS**
  - el nacimiento actual es runtime-only
- **Evitar workflow engines ocultos**
  - chaining simple es válido; orquestación compleja encubierta no
- **La observabilidad debe salir del sistema compartido**
  - no crear subsistemas paralelos de actividad por SaaS

## 10. Qué no es Drako

Drako no es:

- un CMS
- un builder visual
- un workflow engine complejo
- un sistema de colas distribuido
- un monolito SaaS con módulos decorativos

Drako sí es, hoy:

- una plataforma multi-SaaS
- una factory runtime de SaaS
- un sistema operativo de ejecución compartida

## Cierre

El modelo actual ya fija el estándar correcto:

- un SaaS nace por contrato
- se conecta por bootstrap
- opera sobre cores compartidos
- se observa desde módulos comunes
- y puede participar en ejecución transversal sin hacks

Ese es el punto de acoplamiento que debe mantenerse para el crecimiento futuro de Drako.
