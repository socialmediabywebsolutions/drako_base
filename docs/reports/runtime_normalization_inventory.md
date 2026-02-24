# Runtime Normalization Inventory

This report lists all files identified as having explicit `edge` runtime definitions (active or commented-out) that need to be normalized for the Solo-Worker (OpenNext) architecture.

## Files Identified

| File Path | Status |
|-----------|--------|
| `src/app/api/templates/[slug]/route.ts` | Commented out |
| `src/app/api/tasks/[id]/route.ts` | Commented out |
| `src/app/api/social/posts/[id]/route.ts` | Commented out |
| `src/app/api/saas/public/[slug]/route.ts` | Commented out |
| `src/app/api/saas/[id]/tax/periods/route.ts` | Commented out |
| `src/app/api/saas/[id]/tax/profile/route.ts` | Commented out |
| `src/app/api/saas/[id]/health/route.ts` | Commented out |
| `src/app/api/saas/[id]/domains/route.ts` | Commented out |
| `src/app/api/saas/[id]/marketing/route.ts` | Commented out |
| `src/app/api/saas/[id]/marketing/usage/route.ts` | Commented out |
| `src/app/api/reports/[id]/pdf/route.ts` | Commented out |
| `src/app/api/projects/[id]/route.ts` | Commented out |
| `src/app/api/projects/[id]/entitlements/context/route.ts` | Commented out |
| `src/app/api/projects/[id]/entitlements/route.ts` | Commented out |
| `src/app/api/projects/[id]/domains/route.ts` | Commented out |
| `src/app/api/projects/[id]/domains/verify/route.ts` | Commented out |
| `src/app/api/owner/vendor/expenses/[id]/route.ts` | Commented out |
| `src/app/api/owner/saas-factory/create-saas/route.ts` | **Active** |
| `src/app/api/owner/revenue/route.ts` | **Active** |
| `src/app/api/owner/actions/[id]/snooze/route.ts` | Commented out |
| `src/app/api/owner/actions/[id]/execute/route.ts` | Commented out |
| `src/app/api/owner/actions/[id]/dismiss/route.ts` | Commented out |
| `src/app/api/mentoria/sessions/[id]/bill/route.ts` | Commented out |
| `src/app/api/mentoria/sessions/[id]/complete/route.ts` | Commented out |
| `src/app/api/knowledge/documents/[id]/route.ts` | Commented out |
| `src/app/api/knowledge/documents/[id]/links/route.ts` | Commented out |
| `src/app/api/features/[key]/route.ts` | Commented out |
| `src/app/api/employees/[id]/route.ts` | Commented out |
| `src/app/api/employees/[id]/profitability/route.ts` | Commented out |
| `src/app/api/employees/[id]/skills/route.ts` | Commented out |
| `src/app/api/employees/[id]/compliance/route.ts` | Commented out |
| `src/app/api/employees/[id]/partner/route.ts` | Commented out |
| `src/app/api/employees/[id]/appointments/route.ts` | Commented out |
| `src/app/api/employees/[id]/partner/summary/route.ts` | Commented out |
| `src/app/api/email-intake/messages/[id]/route.ts` | Commented out |
| `src/app/api/customers/[id]/partner/route.ts` | Commented out |
| `src/app/api/customers/[id]/appointments/route.ts` | Commented out |
| `src/app/api/customers/[id]/route.ts` | Commented out |
| `src/app/api/customers/[id]/suggestions/route.ts` | Commented out |
| `src/app/api/customers/[id]/bookings/route.ts` | Commented out |
| `src/app/api/customers/[id]/style-notes/route.ts` | Commented out |
| `src/app/api/companies/[id]/domains/route.ts` | Commented out |
| `src/app/api/conversations/[id]/messages/route.ts` | Commented out |
| `src/app/api/clinic/leads/[id]/route.ts` | Commented out |
| `src/app/api/clinic/appointments/[id]/route.ts` | Commented out |
| `src/app/api/clients/[id]/overview/route.ts` | Commented out |
| `src/app/api/billing/webhook/route.ts` | **Active** |
| `src/app/api/appointments/[id]/route.ts` | Commented out |

## Summary
- **Active instances**: 3
- **Commented instances**: 45
- **Total files to normalize**: 48
