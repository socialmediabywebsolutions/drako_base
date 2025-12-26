# drako.systems – SaaS Creator v1 Spec

## Product Goal
Create a public-facing SaaS where agencies or entrepreneurs can spin up their own SaaS offering in minutes. drako.systems acts as the marketing/onboarding shell and relies on DRĀKO BASE as the operational control tower (billing/support, agents, orchestration). Every action in drako.systems must end with the authoritative data stored in DRĀKO BASE (D1 tables + APIs).

## Core Pillars for v1
1. **Landing / Marketing Page**
   - Hero describing the value proposition ("Create your SaaS in minutes").
   - Feature highlights (provisioning automation, billing/support, orchestrator help).
   - CTA: “Empieza ahora” → onboarding wizard.

2. **Onboarding Wizard**
   - Step 1: Collect company / owner basics (name, email, phone, country).
   - Step 2: Collect first SaaS concept (name, slug suggestion, target industry, preferred domain/subdomain).
   - Step 3: Confirm plan → call DRĀKO BASE APIs to create owner/client/saas/client_saas records.
   - Optional: capture billing preferences for future invoices.

3. **Client Dashboard (“Mi SaaS”)**
   - Overview card: SaaS name, status, domain/subdomain, creation date.
   - Quick metrics pulled from DRĀKO BASE (billing summary, ticket summary if available).
   - Actions: open DRĀKO BASE admin (deep-link), request support, update domain info (patch via `/api/saas`).

4. **DRĀKO BASE Integration Layer**
   - Use existing `/api/owners`, `/api/clients`, `/api/saas`, `/api/client-saas` endpoints.
   - Store session/auth tokens for the drako.systems user (scoped to their client + SaaS records).
   - Keep orchestrator context accessible via the right-side panel (read-only mode for v1).

## Data Flow & Mapping
- When a new company signs up:
  1. Create/update Owner (if single-tenant) via `/api/owners`.
  2. Create Client record tied to Owner via `/api/clients`.
  3. Create SaaS via `/api/saas` (name, slug, status draft, domain/subdomain placeholders).
  4. Link Client ↔ SaaS via `/api/client-saas`.
- Store the resulting IDs in drako.systems session so future dashboard calls can fetch up-to-date data (client detail + SaaS detail) from DRĀKO BASE APIs.

## MVP Flow
1. Visitor hits landing page.
2. Clicks “Crear mi SaaS” → onboarding wizard.
3. Completes owner/company info + SaaS info.
4. Wizard calls DRĀKO BASE APIs in sequence, handling errors + showing progress.
5. On success, redirect to `/panel` showing their SaaS dashboard (pull data from the new client + SaaS entries).
6. Provide a CTA to “Abrir DRĀKO BASE Admin” to manage advanced operations.

## Assumptions / Constraints
- Auth for v1 can be email-based magic link or simple session cookie (to be refined later).
- All persistent data lives in DRĀKO BASE (D1). drako.systems stores only session tokens/client identifiers.
- No payments or email sending in v1 (placeholder CTA for “Habla con nosotros” instead).

## Next Steps After Spec Approval
1. Define UI wireframes for landing, wizard steps, and dashboard.
2. Implement public routes with Next.js (app router) + share UI components with DRĀKO BASE when possible.
3. Build service layer to call DRĀKO BASE APIs with proper validation.
4. Add minimal session handling (server actions or middleware) to keep track of the created client/SaaS.
5. Instrument orchestration hooks so the right panel can display SaaS context when logged in.
