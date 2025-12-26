# Staff Portal Overview

## Saas appointments
- `saas_appointments` stores the SaaS-wide agenda for employees.
- Each appointment tracks service, employee, client name/contact, schedule, status, and price snapshot.
- Inventory usage is recorded when an appointment is marked as `DONE`.

## Employee Partner context
The Employee Partner context now includes:
- Appointments for today.
- Schedule summary (totals by status, planned minutes, window).
- Inventory links for the employee's services and derived stock issues.
- Realtime suggestions combining agenda, stock, and fairness signals.

## Staff portal usage
- Entry point: `/staff/[employeeId]?saasId=...`.
- Shows today's appointments with quick status actions.
- Displays stock issues for services the employee will run today.
- Includes local-only timers for hair color services.

## Next steps
- Persist timers in D1 or a Durable Object for multi-device sync.
- Add photo analysis and style intelligence per appointment.
- Connect to client portal for post-visit care and rebooking prompts.
