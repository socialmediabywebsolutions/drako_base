# Observabilidad (Eventos, Métricas, Diagnósticos)

## Objetivo
Depurar en minutos. Nada de “Internal Server Error” a ciegas.

## Correlation
- Generar `x-drako-correlation-id` por request si no existe.
- Incluirlo en logs/eventos/respuestas de error.

## Eventos mínimos recomendados
- routing.resolve.*
- api.error.* (reason/hint)
- provisioning.*
- billing.*

## Diagnósticos intencionales (503)
Motivos típicos:
- binding-missing
- table-missing / migrations-missing
- host_resolution_not_found
- stripe_not_configured

Cada 503 debe incluir:
- reason
- hint
- correlationId
