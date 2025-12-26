# Owner Accounting & Strategy Board

## Overview
The Owner Accounting & Strategy Board is a portfolio-level view that aggregates all SaaS instances for a single owner. It centralizes subscription revenue paid to Drako, pack/vertical context, and estimated vendor margin per SaaS, so the owner can prioritize pricing, upsells, and growth.

## Data Sources
- **Subscriptions / plans**: Stripe-backed subscriptions and plan metadata.
- **Pack / vertical**: Pack definitions (clinic, salon, pet grooming, laundry).
- **Profitability**: Economy snapshot per SaaS (margin estimate for Drako as vendor).

## API
- `GET /api/owner/accounting`
  - Returns a snapshot with per-SaaS rows plus global totals and vertical breakdown.

## UI
- **/owner**
  - KPI cards: total SaaS, MRR, estimated margin.
  - Strategy table: plan, pack/vertical, margin, health status, CTA to open each SaaS.

## Pricing guidance
Recommended plan ranges (reference, not hardcoded in billing):
- Core: 199-249 EUR/mes
- Growth: 299-349 EUR/mes
- Pro: 399-549 EUR/mes

## Relationship to Catalog
The catalog (`/owner/catalog`) is the entry point to create new SaaS products. The Strategy Board helps decide which verticals or plans to add based on current performance.

## Visibility note
Campamento Base (Central Brain) shows what each SaaS pays to Drako and vendor costs by vertical. It does not expose the full financials of the end business.
Ads budgets are paid directly by the customer to Google/Meta; Drako only charges a management fee if enabled.
