# Ecosystem Live Checklist

Updated: 2026-03-13

This checklist tracks the current operational posture of the canonical Drako ecosystem. It is intentionally strict: statuses describe production truth, not aspiration.

| Block | Status | Reason |
| --- | --- | --- |
| Campamento Base | GREEN | Owner control center is now the holding-side surface, not a child SaaS fallback. `/client` owner mode shows canonical SaaS, provisioning jobs, workspace billing/onboarding state, and entry links into real provisioned products. |
| Drako Factory | GREEN | Canonical owner create-SaaS flow, queue, consumer, orchestrator, runtime activation, bootstrap, and custom-domain contract are active and covered by tests. |
| SocialFlow | GREEN | SocialFlow only appears from a real provisioned instance or explicit `local_demo`, runs on the shared tenant workspace contract, exposes a real commercial-activation path through canonical workspace billing, and can now publish one LinkedIn post live from the current workspace. |
| Auth / Surfaces | GREEN | Owner surface, product workspace, and explicit local demo are separated. Campamento Base no longer presents itself as final-user auth for child SaaS products. |
| Canonical Registry | GREEN | Runtime truth is constrained to `saas`, `saas_instances`, `saas_domains`, `provisioning_jobs`, and `campamento_provisioning`. Active `holding_saas_registry` references were removed from runtime paths. |
| Provisioning | GREEN | Visual create-SaaS flow uses the canonical owner route and job status route. No queue bypass or fake completion marker remains in the active path. |
| Domains | GREEN | Canonical provisioning uses Cloudflare Workers custom domains and the primary/custom-domain state is part of terminal job readiness. |
| Billing | YELLOW | Workspace billing, checkout, portal, and webhook base are present and guarded. Commercial maturity still depends on full live Stripe configuration and continued real-world exercise. |
| Team / Invites | YELLOW | Memberships, invites, role guards, and owner protections are implemented. Outbound invite delivery still depends on external email plumbing outside the current repo scope. |
| Onboarding | GREEN | Workspace onboarding is persisted, summarized, and now surfaced clearly in the shell and owner control center. |
| Shell Visual | GREEN | The shared 3-column shell is now consistent across owner mode and product mode, with wide center content, explicit surface labels, and a useful right panel in owner mode. |
| Product Readiness | GREEN | SocialFlow now supports guided pilots, a real upgrade path into paid workspace billing, live LinkedIn publish-now, and live scheduled LinkedIn publishing from the canonical workspace. Broader channel coverage and live analytics still remain MVP-level, but they no longer block the first paying user path. |
| Legacy Debt | YELLOW | Runtime-critical legacy registry paths are neutralized and `/_saas_broken` is no longer an active public surface. Historical repo surface still exists and should keep shrinking, but it no longer acts as active truth for the factory base. |

## Immediate Interpretation

- GREEN means the block is canonic enough to scale on the current architecture.
- YELLOW means the block is operational but still has controlled maturity debt.
- RED would mean the block can still break production truth or operator confidence. There are no RED items in the current canonical path.

## Current Priority Order

1. Continue reducing active-seeming legacy surface outside the canonical factory/runtime path.
2. Keep exercising the owner create-SaaS flow with real products so the control center remains grounded in live operations.
3. Move SocialFlow from first-paying-user-ready into the next real bottleneck: one stronger live signal beyond LinkedIn publishing, preferably real analytics for the same live channel.
