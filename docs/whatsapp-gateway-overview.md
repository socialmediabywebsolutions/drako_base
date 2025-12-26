# WhatsApp Gateway v1

## Overview
WhatsApp Gateway v1 is a simulated, multi-tenant gateway that maps phone numbers to actors and routes inbound messages to deterministic intents. It writes all messages into D1/demo and mirrors them into Conversations for history.

## Tables
- `saas_whatsapp_identities`
  - Maps a phone number to an actor (SAAS_OWNER, EMPLOYEE, CUSTOMER, PLATFORM_OWNER).
- `saas_whatsapp_messages`
  - Stores inbound/outbound WhatsApp messages (simulated).

## Core flow
1. **Inbound** message hits `/api/whatsapp/inbound`.
2. Gateway resolves identity by phone.
3. Intent classification is deterministic (no external AI).
4. Automation dispatches to existing modules:
   - Customers: appointments list/confirm/reschedule.
   - Employees: today schedule, tasks, playbooks.
   - SaaS owners: daily summary, open tasks.
5. Messages are written to Conversations as a WhatsApp thread.

## Integrations
- **Conversations**: Each phone number gets a WhatsApp conversation for history.
- **Tasks**: Employees/owners can retrieve task lists.
- **Appointments**: Customers can view/confirm next appointment.
- **Owner Control**: Daily summary for SaaS owners.
- **Drako Vendor**: resumen de gastos vendor para owner/platform.

## Demo usage
- Use the WhatsApp section in `/saas/[id]` to send a test inbound message.
- Demo identities include: owner, employees, and customers.

## Future (v2)
- Connect a real provider (Twilio/360dialog/etc.) to `/api/whatsapp/inbound`.
- Map provider message IDs into `provider_message_id`.
- Add rate limits and per-identity templates.

## v2 Flujos operativos
Rol | Intent | Módulo
--- | --- | ---
Customer | `CUSTOMER_NEXT_APPOINTMENT` | Appointments + Customers
Customer | `CUSTOMER_TODAY_APPOINTMENTS` | Appointments + Customers
Customer | `CUSTOMER_CONFIRM_APPOINTMENT` | Appointments (status CONFIRMED)
Customer | `CUSTOMER_CANCEL_APPOINTMENT` | Appointments (status CANCELLED)
Employee | `EMPLOYEE_TODAY_SCHEDULE` | Appointments (agenda del día)
Employee | `EMPLOYEE_WEEK_SCHEDULE` | Appointments (resumen semanal)
Employee | `EMPLOYEE_TODAY_TASKS` | Tasks (open / in progress)
Owner | `OWNER_DAILY_SUMMARY` | Owner Control + Appointments + Tasks
Owner | `SHOW_TAX_SUMMARY` | Tax Engine
Owner | `OWNER_VENDOR_SUMMARY` | Drako Vendor Snapshot

### Ejemplos de mensajes
- Cliente: “próxima cita”, “tengo cita hoy”, “confirmo mi cita”, “cancelar mi cita”.
- Empleado: “mi horario de hoy”, “mi horario de esta semana”, “mis tareas de hoy”.
- Dueño: “resumen de hoy”, “tareas abiertas”, “resumen impuestos”, “resumen gastos drako”.

### Nota
Respuestas deterministas, sin IA externa. WhatsApp actúa como capa de comandos rápidos sobre los módulos existentes.
