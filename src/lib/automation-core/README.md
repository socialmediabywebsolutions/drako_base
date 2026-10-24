# Drako Automation Core

## Que es

Automation Core es el modulo base de Drako para registrar, activar, ejecutar y auditar automatizaciones de un SaaS por `tenantId` y `saasId`.

Resuelve un problema muy concreto:

- saber que automatizaciones existen para una instancia SaaS
- saber si estan activas o no
- dispararlas manualmente o por un trigger externo
- guardar el resultado de cada ejecucion
- consultar historial y resumen operativo

## Que NO hace

Automation Core no es:

- un scheduler
- una cola
- un worker runtime
- un workflow engine multipaso
- una capa de IA
- una capa de integraciones externas
- logica de negocio de un SaaS concreto

El Core administra el contrato operativo.
Cada SaaS sigue siendo duenyo de su handler y de su trabajo real.

## Conceptos clave

### Automation registration

Registro operativo de una automatizacion.

Incluye:

- `tenantId`
- `saasId`
- `automationKey`
- `displayName`
- `enabled`
- `scheduleMode`
- `frequency`
- `config`
- `ownerScope`

### Execution

Una ejecucion concreta de una automatizacion.

Incluye:

- trigger de origen
- estado final
- resumen
- metricas
- output
- error normalizado
- timestamps

### History

Historial de ejecuciones ya cerradas.

Permite:

- listar runs
- filtrar por tenant, saas y automation key
- ver errores
- ver metricas agregadas

### Handler

Funcion implementada por un SaaS para ejecutar una automatizacion concreta.

El Core no sabe como funciona el negocio.
Solo sabe invocar el handler y persistir el resultado.

## Contrato del handler

### Input

- `tenantId`
- `saasId`
- `automationKey`
- `config`
- `triggerType`
- `executionId`

### Output

- `ok`
- `summary`
- `metrics`
- `output`
- `error`

### Semantica

- `ok = true`
  - la ejecucion termina como `SUCCESS`
- `ok = false`
  - la ejecucion termina como `FAILED`
- si el handler lanza una excepcion
  - el Core la normaliza como `AUTOMATION_HANDLER_ERROR`
  - la ejecucion termina como `FAILED`

## Operaciones disponibles

### Registry

- `registerAutomation`
- `getAutomation`
- `listAutomations`
- `enableAutomation`
- `disableAutomation`

### Execution lifecycle

- `registerAutomationHandler`
- `triggerAutomation`
- `recordExecutionStart`
- `recordExecutionResult`

### History

- `listAutomationExecutions`
- `getAutomationExecutionSummary`

## Flujo completo de ejecucion

1. Un SaaS registra una automatizacion con `registerAutomation`.
2. El SaaS registra un handler con `registerAutomationHandler`.
3. Un owner o un sistema llama a `triggerAutomation`.
4. El Core valida:
   - `tenantId`
   - `saasId`
   - `automationKey`
   - que la automatizacion exista
   - que este habilitada
   - que tenga handler registrado
5. El Core crea un execution record en estado `RUNNING`.
6. El Core invoca el handler del SaaS con el contrato comun.
7. El handler devuelve `ok/summary/metrics/output/error`.
8. El Core normaliza el resultado.
9. El Core cierra la ejecucion como `SUCCESS` o `FAILED`.
10. El historial queda disponible via `listAutomationExecutions`.
11. El resumen agregado queda disponible via `getAutomationExecutionSummary`.

## Reglas de borde

- No se puede ejecutar una automatizacion inexistente.
- No se puede ejecutar una automatizacion desactivada.
- No se puede ejecutar sin handler.
- El Core no importa nada de SocialFlow ni de otro SaaS.
- El Core solo depende de D1 y de su propio contrato.
