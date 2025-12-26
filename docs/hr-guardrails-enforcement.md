# HR Guardrails Enforcement v2

## Cambios en HR Settings
Se extiende `employee_hr_settings` con:
- `block_overwork` (bloquear sobrecarga de horas).
- `block_underpay` (bloquear citas si el salario/hora efectivo está por debajo del mínimo).
- `min_rest_hours_between_shifts` (descanso mínimo entre citas/turnos).

## Flujo de guardrails
1) API de citas evalúa guardrails antes de crear o confirmar una cita.
2) Si el guardrail es **BLOCK**, la API responde `HARD_GUARDRAIL_VIOLATION`.
3) Si el guardrail es **WARN**, la cita se crea y se devuelve el warning para UI.

## Qué se evalúa
- **Overwork**: horas proyectadas en la semana vs. `maxHoursWeek` / `maxWeeklyHoursDefault`.
- **Rest time**: descanso entre citas comparado con `min_rest_hours_between_shifts`.
- **Underpay**: tarifa efectiva < `minHourlyWage` (usa Fairness Guard).

## UI
- Staff Portal muestra bloqueos o avisos cuando aplica.
- Owner Control muestra el estado de enforcement (bloquear vs avisar).

