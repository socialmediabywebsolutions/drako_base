# Runbook: AI Router Incidents (v1.1)

Este documento detalla los pasos para diagnosticar y resolver incidentes relacionados con el AI Router (cuotas, breakers, caídas de proveedores).

## 1. Error 402: Quota Exceeded (Presupuesto)
**Síntoma**: Los usuarios ven un error de "Cuota de IA excedida".
- **Causa**: El tenant ha consumido todos sus tokens mensuales.
- **Acción**: 
  1. Verificar uso en D1: `SELECT * FROM ai_usage_counters WHERE key LIKE 'tenantId%'`.
  2. Si es legítimo, ofrecer upgrade de plan o resetear manualmente (bajo aprobación): 
     `UPDATE ai_usage_counters SET tokens_in = 0, tokens_out = 0 WHERE key = 'tenantId:YYYY-MM'`.

## 2. Error 503: Service Unavailable (Circuit Breaker OPEN)
**Síntoma**: Las llamadas de IA fallan instantáneamente con 503.
- **Causa**: El modelo/proveedor ha fallado repetidamente y el circuito se ha abierto para proteger el sistema.
- **Acción**:
  1. Revisar logs: `SELECT * FROM ai_breaker_logs WHERE breaker_key = 'ai:provider:model' ORDER BY created_at DESC LIMIT 5`.
  2. Verificar si el proveedor (Cloudflare/OpenAI) tiene una caída global.
  3. Si el proveedor ya funciona, resetear circuito:
     `UPDATE ai_circuit_breakers SET state = 'CLOSED', failure_count = 0, opened_at = NULL WHERE key = '...'`.

## 3. Error 429: Too Many Requests (Rate Limit)
**Síntoma**: Error de "Límite de velocidad excedido".
- **Causa**: Picos de tráfico por encima de la política definida (50 req/min).
- **Acción**:
  1. Identificar si es un ataque o uso legítimo: `SELECT * FROM ai_request_audits WHERE tenant_id = '...' AND created_at > datetime('now', '-10 minutes')`.
  2. Si es legítimo, aumentar el límite en la lógica del Worker o crear una política de bypass en `ai_provider_policies` si se implementa soporte para RL dinámico.

## 4. Fallback a Cloudflare AI
**Síntoma**: La calidad de las respuestas baja repentinamente (ej: de GPT-4 a Llama 8B).
- **Causa**: El router ha activado el fallback automático porque el proveedor premium está en breaker.
- **Acción**: Seguir el punto 2 (Circuit Breaker) para restaurar el servicio premium cuando esté estable.

## Escalabilidad y Debug
- Todos los logs técnicos en Cloudflare contienen el `correlationId`. Usar este ID para filtrar en el dashboard de Cloudflare Workers.
