# Antigravity Drako Rules

## Purpose

These rules define how Antigravity IDE must work inside the Drako ecosystem.

The goal is to protect the architecture, avoid accidental coupling between SaaS products, and keep every change aligned with the Cloudflare-first runtime.

---

## 1. Canonical ecosystem architecture

Drako is not a single mixed SaaS.

The correct architecture is:

* Drako: central brand and ecosystem umbrella.
* Campamento Base: internal operator and control plane.
* Mentoría: independent educational SaaS.
* SocialFlow: independent social automation SaaS.
* Factory: future SaaS provisioning layer.
* Capabilities: reusable modules shared across SaaS products through explicit contracts.

Never mix Mentoría business logic into SocialFlow.

Never mix SocialFlow business logic into Mentoría.

Never turn Campamento Base into an end-user workspace.

Never treat Drako as a tenant workspace.

---

## 2. Cloudflare-first rule

All new architecture must prioritize Cloudflare.

Preferred stack:

* Cloudflare Workers
* OpenNext
* Next.js App Router
* D1
* R2
* KV
* Queues
* AI Gateway
* Workers AI
* Wrangler

Do not propose Firebase, Supabase, Vercel, Render, a classic Node server, or an external backend unless the user explicitly authorizes it.

The canonical runtime is:

```txt
Next.js App Router + OpenNext Worker + Cloudflare Workers
```

---

## 3. Local runtime rule

There are two local execution modes:

```txt
Next dev :3000
```

Useful for fast UI iteration.

```txt
Wrangler :8787
```

Required for validating middleware, auth, routing, D1, Workers, bindings, and runtime behavior.

Never close a task involving middleware, auth, D1, Workers, routing, API boundaries, cookies, host logic, or deployment configuration by validating only in `:3000`.

Critical runtime validation must consider `:8787`.

---

## 4. Critical files

Do not modify these files or folders without explicit permission:

```txt
src/middleware.ts
wrangler.jsonc
wrangler.workers.toml
open-next.config.ts
next.config.ts
package.json
pnpm-lock.yaml
migrations/**
workers/**
src/app/api/**
src/lib/**/auth*
src/lib/**/tenants*
src/lib/**/repositories*
.github/**
scripts/**
tests/**
.env*
.dev.vars
```

You may read and analyze them, but do not edit them without clear authorization.

---

## 5. Forbidden autonomous actions

Never run or perform these actions without explicit permission:

```txt
git add
git commit
git reset
git clean
rm
del
Remove-Item
pnpm install
npm install
wrangler deploy
deployment commands
secret changes
.env changes
destructive file operations
```

The user performs commits manually from GitHub Desktop.

Do not create commits.

Do not say that a commit has been created.

---

## 6. Naming rules

Use English names.

Use plural names for collections, folders, modules, routes, tables, and system entities when they represent groups.

Correct examples:

```txt
agents
documents
alerts
metrics
capabilities
workflows
```

Avoid inconsistent singular names for collections:

```txt
agent
document
alert
metric
```

---

## 7. SaaS boundaries

Each SaaS must remain vertical and independent.

### Mentoría

Mentoría owns:

* education
* families
* students
* guardians
* family onboarding
* pedagogical agents
* educational memory
* emotional support
* educational WhatsApp flows

### SocialFlow

SocialFlow owns:

* social marketing
* social publishing
* audience intelligence
* lead intelligence
* relationship memory
* campaign orchestration
* social automation
* social CRM

### Campamento Base

Campamento Base owns:

* internal control plane
* observability
* global metrics
* events
* operational governance
* portfolio coordination
* operator surfaces

### Factory

Factory owns:

* provisioning
* blueprints
* SaaS creation
* domains
* billing setup
* reusable capabilities registration

---

## 8. No fake completion

Do not declare a feature finished unless it is implemented and validated.

Do not turn documentation into production code without checking existing contracts.

Do not duplicate logic.

Do not create new routes without explaining:

* boundary
* auth context
* tenant context
* middleware impact
* runtime impact
* tests needed

---

## 9. Validation policy

Before considering any change ready, recommend the relevant validations:

```txt
pnpm typecheck
npx vitest run
pnpm build
pnpm dev:wrangler
git status
```

For middleware, auth, routing, D1, Workers, or runtime changes, validation in Wrangler `:8787` is required.

---

## 10. Work mode

Before editing files:

1. Analyze first.
2. Explain the plan.
3. List the files that would be touched.
4. Wait for explicit authorization.
5. Apply the smallest safe change.
6. Report modified files.
7. Report validations executed or pending.

Never make large automatic refactors.

Never modify multiple SaaS boundaries in one uncontrolled change.

Prefer small, reviewable blocks.

---

## 11. First response behavior

When starting a new task, first confirm:

* what part of the ecosystem is affected
* whether the task touches runtime, middleware, auth, D1, Workers, routes, tests, or deployment
* whether the task is read-only or requires file edits
* what validation will be required

If the user asks for broad work such as “fix everything”, “separate all SaaS”, or “clean the architecture”, do not start editing immediately.

Instead, propose a staged plan.
