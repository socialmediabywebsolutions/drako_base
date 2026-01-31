# Drako Swarm: Agent Specifications v1 (Production Catalog)

## Section 1: What is Drako Swarm
The Drako Swarm is a coordinated factory of specialized AI agents designed to automate the lifecycle of SaaS product creation, marketing, and multi-tenant operations. The swarm follows a layered architecture to ensure clear separation of concerns, scalability, and robust governance.

## Section 2: Agent Contract
Every agent in the Drako Swarm MUST adhere to the following contract:

### Shared Contract Attributes
- **Identity**: Stable plural slug (agent_id), human name (label), and versioning.
- **Layering**: Categorized as `CORE`, `PARTNER`, or `OPERATOR`.
- **Verticality**: Scoped to specific business domains (e.g., SOCIAL, REAL_ESTATE) or generic.
- **Event-Driven**: Must emit and consume namespaced events.
- **Measurable**: Must define KPIs and guardrails for cost, time, and quality.

## Section 3: Permissions Model
Permissions are strictly defined and categorized:

| Category | Typical Scopes |
| :--- | :--- |
| **Cloudflare** | `pages`, `workers`, `d1`, `kv`, `r2`, `queues`, `cron`, `ai_gateway`, `vectorize` |
| **Stripe** | `billing`, `products`, `prices`, `metering`, `webhooks`, `customers`, `invoices` |
| **OAuth** | `google`, `facebook`, `linkedin`, `x`, `instagram`, `drive`, `gmail`, `calendar` |
| **Data (R/W)** | `projects`, `companies`, `entitlements`, `knowledge_bases`, `interviews`, `quotes` |

## Section 4: Event Model
Agents communicate via an asynchronous event bus. 
- **Namespace**: `agents.{agent_id}.{event_name}`
- **Retry Policy**: Default 3 attempts with exponential backoff.
- **Idempotency**: All consumers must implement idempotency using a unique `event_id` or business key.

## Section 5: KPI/Guardrails Model
Performance is tracked using:
- **Quality Score**: AI-evaluated output correctness.
- **Time to Value**: Latency between input and output.
- **Cost Estimate**: Predicted vs actual token/resource cost.
- **Guardrails**: Hard limits on spend per project and execution timeouts.

## Section 6: Per-Agent Specs

### CORE (12)
Essential agents for swarm coordination and SaaS foundational logic.

1. **interviews**
   - **Mission**: Extracts business blueprints from user interaction.
   - **Outputs**: Blueprint metadata, feature list.
   - **Permissions**: `data:write:interviews`, `data:write:projects`.

2. **orchestrations**
   - **Mission**: High-level task planning and delegation.
   - **Consumes**: `agents.interviews.finalized`.
   - **Emits**: `agents.orchestrations.plan_created`.

3. **supervisions**
   - **Mission**: Quality gatekeeper for all swarm outputs.

4. **architectures**
   - **Mission**: Technical stack and resource mapping.

5. **analyses**
   - **Mission**: Multi-dimensional data processing.

6. **finances**
   - **Mission**: Pricing logic and economic monitoring.

7. **legals**
   - **Mission**: Contract drafting and compliance validation.

8. **securities**
   - **Mission**: IAM and infrastructure security auditing.

9. **knowledges**
   - **Mission**: RAG management and context injection.

10. **automations**
    - **Mission**: Workflow engineering and script generation.

11. **observabilities**
    - **Mission**: Real-time health and performance tracking.

12. **deliveries**
    - **Mission**: CI/CD and production deployment management.

### PARTNER — SOCIAL (12)
Domain-specific agents for marketing and social media automation.

13. **media_strategies**
14. **content_plannings**
15. **copywritings**
16. **visual_creations**
17. **social_analytics**
18. **ads_managements**
19. **competitor_watchings**
20. **trend_scoutings**
21. **brand_voices**
22. **campaign_orchestrations**
23. **community_managements**
24. **asset_managements**

### PARTNER — REAL ESTATE (12)
Domain-specific agents for real estate business flows.

25. **listings_managements**
26. **valuations**
27. **market_analyses**
28. **lead_managements**
29. **rental_flows**
30. **sales_flows**
31. **contracts_generations**
32. **commission_trackings**
33. **fiscal_accountings**
34. **customer_screenings**
35. **property_portals_syncings**
36. **viewings_schedulers**

### OPERATORS (12)
Direct resource manipulators and external service connectors.

37. **stripe_billings**
38. **stripe_meterings**
39. **stripe_webhooks**
40. **cloudflare_provisionings**
41. **d1_migrations**
42. **kv_sessions**
43. **r2_documents**
44. **queues_dispatchings**
45. **cron_schedulers**
46. **oauth_connections**
47. **email_intakes**
48. **calendar_syncings**

> [!NOTE]
> For brevity, the full JSON schemas and specific event lists are maintained in the machine-readable catalog.
