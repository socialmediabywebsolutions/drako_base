# Subsidiary Protocol (SaaS Registration)

**Purpose**: Defines how a new SaaS Product is on-boarded into the Campamento Base Holding.

## 1. Registration (`holding_saas_registry`)
To launch a new SaaS (e.g., "SocialFlow"), you must INSERT into `holding_saas_registry`:

```sql
INSERT INTO holding_saas_registry (saas_slug, display_name, status, default_domain)
VALUES ('socialflow', 'SocialFlow Marketing', 'active', 'socialflow.io');
```

## 2. Pricing Plans (`saas_pricing_plans`)
Define the standard tiers for the SaaS.

```sql
INSERT INTO saas_pricing_plans (id, saas_slug, plan_code, monthly_price_cents, limits_json, features_json)
VALUES 
('plan_sf_starter', 'socialflow', 'starter', 2900, '{"posts": 100}', '{"analytics": false}'),
('plan_sf_pro',     'socialflow', 'pro',     9900, '{"posts": 1000}', '{"analytics": true}');
```

## 3. Quota Definition
The `limits_json` in the plan DEFINES the quotas that will be initialized in `saas_usage_quotas` upon subscription.

## 4. Domain Mapping
*   **Primary Domain**: Defined in Cloudflare (e.g., `socialflow.io`).
*   **Routing**: The application logic must use `resolveSaasContext` to map `socialflow.io` -> `saas_slug='socialflow'`.

## 5. Billing Integration
*   **Stripe Product**: Create a Product in Stripe with `metadata.saas_slug = 'socialflow'`.
*   **Webhook**: No code changes needed. The central webhook reads the metadata and routes events.
