# Runbook: Gestión de Incidentes Steel v1.0.1

Este documento describe los procedimientos operativos para manejar incidentes de infraestructura detectados por los mecanismos de Steel v1.0.1.

## 1. Throttling (Rate Limiting)
**Síntoma:** Usuarios reportan errores `429 Too Many Requests`. Alertas de `rate.limit.blocked` en el log de eventos.

### Diagnóstico
1. Consultar la tabla `rate_limit_audits` en D1 para identificar qué tenant y qué ruta están saturados.
   ```sql
   SELECT tenant_id, route, COUNT(*) as drops 
   FROM rate_limit_audits 
   WHERE created_at > datetime('now', '-1 hour')
   GROUP BY tenant_id, route;
   ```
2. Verificar si es un ataque de fuerza bruta o uso legítimo que supera el plan (Free vs Pro).

### Acción
- **Legítimo:** Actualizar el plan del tenant en la tabla `tenants`.
- **Abuso:** Identificar la IP del audit log y bloquearla en el WAF de Cloudflare.

## 2. AI Budget Exceeded
**Síntoma:** IA devuelve errores `AI_QUOTA_HARD_LIMIT` (Status 402).

### Diagnóstico
1. Verificar consumo en `ai_usage_counters`.
2. Revisar `ai_quota_soft` en los logs para ver si se ignoraron avisos previos.

### Acción
1. Evaluar si el tenant necesita una ampliación de cuota.
2. Si es error de sistema, resetear el contador de tokens para el mes actual (CUIDADO: Solo bajo supervisión).

## 3. Circuit Breaker Operativo
**Síntoma:** El sistema responde `AI_CIRCUIT_OPEN` inmediatamente sin intentar llamar al proveedor.

### Diagnóstico
1. Consultar `ai_breaker_logs` para ver la causa del primer fallo (ej: `Invalid API Key`, `Provider Down`).
2. Verificar el estado del proveedor (Fireworks/OpenAI).

### Acción
1. **Fallo del Proveedor:** Esperar al restablecimiento automático (Half-Open tras 5 min).
2. **Fallo de Configuración:** Corregir la API Key en los secretos de Wrangler.

## 4. Recuperación de DLQ (Dead Letter Queue)
**Síntoma:** Trabajos en cola fallan repetidamente y terminan en la DLQ.

### Acción
1. Inspeccionar mensajes en la DLQ buscando patrones de error comunes.
2. Una vez corregido el bug en el código, usar el script de mantenimiento `scripts/requeue-dlq.ts` para re-encolar mensajes.
   > [!NOTE]
   > Gracias a la Idempotencia (tabla `processed_jobs`), es seguro re-encolar sin miedo a duplicar datos procesados parcialmente.

---
🚀 **Drako-Forge Steel: Resiliencia por Diseño.**
