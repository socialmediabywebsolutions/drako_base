# P3 INTELLIGENT ALERTS - Automatic Problem Detection

**Status**: IMPLEMENTED - Ready for Production  
**Runtime**: Cloudflare Workers + D1 Real  
**Date**: 2026-03-29

---

## OVERVIEW

Sistema automático de detección de problemas del alumno:

**Flujo**:
```
Eventos Reales (D1)
    ↓
Análisis de Métricas
    ├─ Actividad diaria
    ├─ Tendencia (sube/baja)
    ├─ Errores por tipo
    └─ Progreso
    ↓
Reglas de Detección
    ├─ LOW_ACTIVITY (↓ > 40% vs media)
    ├─ REPEATED_ERRORS (mismo error ≥ 3 veces)
    ├─ NO_PROGRESS (actividad sin progreso)
    └─ DROPOUT_RISK (baja actividad + baja interacción)
    ↓
Alertas Inteligentes
    ↓
Persistencia en D1
    ↓
Notificación Automática
    ↓
WhatsApp a Guardián
```

**Características**:
- ✅ Análisis real de eventos (últimos 7 días)
- ✅ 4 reglas de detección inteligentes
- ✅ Alertas con severidad (low/medium/high)
- ✅ Mensajes humanos y accionables
- ✅ Persistencia en D1 real
- ✅ Notificaciones automáticas (app + WhatsApp)
- ✅ Endpoint de automatización (Cloudflare Cron ready)

**Restricciones Cumplidas**:
- ✅ Sin mocks
- ✅ Sin JSON fallback
- ✅ Sin lógica en memoria
- ✅ D1 real vía binding DRACO_DB
- ✅ Runtime Cloudflare Workers
- ✅ Fail-closed obligatorio

---

## 1. D1 SCHEMA

### Migración: `0156_mentoria_alerts.sql`

#### `alerts` (Central)
```sql
CREATE TABLE alerts (
  id TEXT PRIMARY KEY,
  student_id TEXT NOT NULL,
  family_id TEXT NOT NULL,
  type TEXT NOT NULL,  -- 'LOW_ACTIVITY' | 'REPEATED_ERRORS' | 'NO_PROGRESS' | 'DROPOUT_RISK'
  severity TEXT NOT NULL,  -- 'low' | 'medium' | 'high'
  message TEXT NOT NULL,  -- Mensaje humano para el padre
  metadata TEXT,  -- JSON con datos de análisis
  resolved BOOLEAN DEFAULT 0,
  resolved_at TEXT,
  created_at TEXT NOT NULL
)
```

**Ejemplo de mensaje**:
```
"Detectamos que tu hijo ha reducido su actividad esta semana. 
Podría estar perdiendo el ritmo. Recomendamos dedicar 15 minutos 
mañana para retomar."
```

#### `alert_analyses` (Tracking)
```sql
CREATE TABLE alert_analyses (
  id TEXT PRIMARY KEY,
  alert_id TEXT NOT NULL,
  event_id TEXT NOT NULL,
  metric_name TEXT,
  metric_value REAL,
  threshold REAL,
  created_at TEXT NOT NULL
)
```

---

## 2. ALERT ENGINE

### Archivo: `src/lib/mentoria/alert-engine.ts`

**Función Principal**:
```typescript
async function detectAlertsForStudent(studentId: string, familyId: string): Promise<Alert[]>
```

**Funciones Auxiliares**:

#### `analyzeStudentMetrics(studentId, daysBack)`
- Lee eventos de últimos N días
- Calcula:
  - `activeMinutes`: tiempo total activo
  - `activitiesCompleted`: actividades realizadas
  - `sessionsCount`: sesiones completadas
  - `progressUpdates`: actualizaciones de progreso
  - `errorCount`: total de errores
  - `errorsByType`: conteo por tipo de error
  - `dailyActivity`: actividad por día
  - `progressScore`: puntuación de progreso
  - `lastActivityTime`: último evento

#### `calculateDailyActivityAverage(dailyActivity)`
- Calcula promedio de actividad diaria
- Base para detectar cambios

#### `detectAlerts(studentId, familyId, metrics)`
- Aplica 4 reglas de detección
- Retorna array de alertas generadas

---

## 3. REGLAS DE DETECCIÓN

### REGLA 1: LOW_ACTIVITY
**Condición**: Actividad ↓ > 40% vs media
```typescript
if (recentAvg < avgDaily * 0.6) {
  // Generar alerta
}
```

**Mensaje**:
```
"Detectamos que tu hijo ha reducido su actividad esta semana. 
Podría estar perdiendo el ritmo. Recomendamos dedicar 15 minutos 
mañana para retomar."
```

**Severidad**: medium

---

### REGLA 2: REPEATED_ERRORS
**Condición**: Mismo error ≥ 3 veces
```typescript
if (errorsByType[errorType] >= 3) {
  // Generar alerta
}
```

**Mensaje**:
```
"Tu hijo ha tenido dificultades repetidas con 'división'. 
Recomendamos practicar este tema específicamente. 
¿Necesita ayuda adicional?"
```

**Severidad**: medium

---

### REGLA 3: NO_PROGRESS
**Condición**: Actividad sin progreso real
```typescript
if (activitiesCompleted > 5 && progressUpdates === 0) {
  // Generar alerta
}
```

**Mensaje**:
```
"Tu hijo ha completado varias actividades pero no hay progreso 
registrado. Podría haber un problema técnico o necesita 
retroalimentación. Por favor, revisa su trabajo."
```

**Severidad**: high

---

### REGLA 4: DROPOUT_RISK
**Condición**: Baja actividad + baja interacción
```typescript
if (activeMinutes < 30 && daysSinceLastActivity > 2) {
  // Generar alerta
}
```

**Mensaje**:
```
"Alerta importante: Tu hijo no ha estado activo en los últimos 
3 días. Existe riesgo de abandono. Te recomendamos contactar 
para entender qué está pasando."
```

**Severidad**: high

---

## 4. ENDPOINTS REALES

### `/api/internal/run-alert-detection` (POST)

**Ejecuta detección de alertas automáticamente**:
```bash
POST /api/internal/run-alert-detection
```

**Flujo**:
1. Obtiene estudiantes activos (eventos en últimos 7 días)
2. Ejecuta `detectAlertsForStudent()` para cada uno
3. Genera eventos de alerta
4. Crea notificaciones automáticas
5. Intenta envío WhatsApp

**Response**:
```json
{
  "status": "SUCCESS",
  "studentsProcessed": 10,
  "alertsGenerated": 15,
  "notificationsCreated": 30,
  "whatsappSent": 28,
  "errors": []
}
```

**Nota**: Este endpoint será llamado por Cloudflare Cron Triggers en producción (ej: diariamente a las 19:00)

### `/api/internal/validate-alerts` (GET)

**Valida flujo completo**:
```bash
curl http://localhost:8787/api/internal/validate-alerts
```

**Tests**:
1. ✅ Create Family
2. ✅ Create Student
3. ✅ Create Guardian
4. ✅ Register WhatsApp Contact
5. ✅ Emit Events (LOW_ACTIVITY scenario)
6. ✅ Emit Events (REPEATED_ERRORS scenario)
7. ✅ Verify Events Persisted in D1
8. ✅ Detect Alerts (Rule Engine)
9. ✅ Verify Alerts Persisted in D1
10. ✅ Generate Notifications from Alert Events
11. ✅ Verify Notifications Persisted in D1
12. ✅ Verify WhatsApp Integration
13. ✅ Verify Full Flow (eventos → análisis → alertas → notificaciones)

---

## 5. INTEGRACIÓN CON NOTIFICATION ENGINE

**Automático**:
```typescript
// Al detectar alerta, se emite evento
const event = await emitEvent({
  type: "student.alert.generated",
  actorType: "system",
  actorId: "alert-detection-job",
  studentId,
  familyId,
  metadata: {
    alertId,
    alertType,
    alertSeverity,
    alertMessage
  }
});

// Se generan notificaciones automáticamente
const notifications = await generateNotificationsFromEvent(event);
```

**Regla de Notificación**:
```typescript
"student.alert.generated" → guardian (app + whatsapp)
```

---

## 6. EJECUCIÓN LOCAL

### Setup (Una sola vez)
```bash
# Crear D1 local
wrangler d1 create drako_db_local --local

# Aplicar migraciones
wrangler d1 execute drako_db_local --local < migrations/0153_mentoria_family_foundation.sql
wrangler d1 execute drako_db_local --local < migrations/0154_mentoria_events_notifications.sql
wrangler d1 execute drako_db_local --local < migrations/0155_mentoria_summaries.sql
wrangler d1 execute drako_db_local --local < migrations/0156_mentoria_alerts.sql
```

### Validación (Cada vez)
```bash
# Terminal 1: Iniciar Wrangler dev
wrangler dev --local

# Terminal 2: Ejecutar validación completa
curl http://localhost:8787/api/internal/validate-alerts

# Terminal 2: Ejecutar detección de alertas
curl -X POST http://localhost:8787/api/internal/run-alert-detection
```

---

## 7. ARQUITECTURA

### Stack
- **Runtime**: Cloudflare Workers (Next.js + OpenNext)
- **Database**: D1 (SQLite en Cloudflare)
- **Binding**: DRACO_DB (inyectado por Cloudflare)
- **Analysis**: Rule-based detection
- **Notifications**: Event-driven
- **WhatsApp**: Twilio / Meta API (fetch-based)

### Flujo de Datos
```
Student Activity (Real)
    ↓
emitEvent() → D1 (events table)
    ↓
detectAlertsForStudent()
    ├─ analyzeStudentMetrics() → extrae datos reales
    ├─ calculateDailyActivityAverage() → calcula tendencia
    └─ detectAlerts() → aplica 4 reglas
    ↓
Alert Detected
    ├─ type: LOW_ACTIVITY | REPEATED_ERRORS | NO_PROGRESS | DROPOUT_RISK
    ├─ severity: low | medium | high
    └─ message: humano y accionable
    ↓
INSERT → D1 (alerts table)
    ↓
emitEvent("student.alert.generated")
    ↓
generateNotificationsFromEvent()
    ├─ INSERT → D1 (notifications)
    └─ channel: whatsapp
    ↓
WhatsApp Service
    └─ sendMessage() → Guardian
```

---

## 8. CONFIGURACIÓN PRODUCCIÓN

### Variables de Entorno
```bash
WHATSAPP_API_KEY=your-twilio-or-meta-key
WHATSAPP_PROVIDER=twilio  # o "meta"
```

### Cloudflare Cron Trigger
```toml
# En wrangler.toml
[[triggers.crons]]
cron = "0 19 * * *"  # Diariamente a las 19:00 UTC
```

### Handler
```typescript
export async function scheduled(event: ScheduledEvent, env: Env, ctx: ExecutionContext) {
  const response = await fetch(`https://${env.DOMAIN}/api/internal/run-alert-detection`, {
    method: "POST",
  });
  // ...
}
```

---

## 9. SEGURIDAD & COMPLIANCE

- ✅ Tenant isolation (family_id + student_id)
- ✅ Opt-in para WhatsApp
- ✅ Fail-closed (requiere binding real)
- ✅ No datos en memoria
- ✅ Persistencia en D1 real
- ✅ Audit trail (events + alerts)
- ✅ Resolución manual de alertas

---

## 10. PRÓXIMOS PASOS (P4)

1. **Dashboard de Alertas**
   - Ver alertas activas
   - Historial de alertas
   - Marcar como resueltas

2. **Escalation**
   - Alertas no resueltas → email a coordinador
   - Alertas críticas → notificación inmediata

3. **Machine Learning**
   - Aprender patrones de cada estudiante
   - Umbrales personalizados
   - Predicción de dropout

4. **Intervención Automática**
   - Sugerir recursos
   - Asignar tareas de refuerzo
   - Notificar a profesor

5. **Analytics**
   - Tasa de detección
   - Tasa de resolución
   - Efectividad de alertas

---

## SUCCESS CRITERIA

✅ Alertas generadas desde datos reales  
✅ 4 reglas de detección funcionando  
✅ Persistidas en D1  
✅ Notificaciones creadas automáticamente  
✅ WhatsApp trigger ejecutado  
✅ Endpoint de automatización funcional  
✅ Validación completa pasando  
✅ Sin mocks, sin fallback, sin alternativas  

---

## FINAL STATUS

**P3 INTELLIGENT ALERTS: IMPLEMENTED & READY FOR PRODUCTION**

Sistema automático de detección de problemas  
Eventos reales → análisis → alertas inteligentes → notificaciones WhatsApp  
100% Cloudflare Workers + D1 Real  
