-- Migration 0107: Multi-Provider & Cron Support (Steel Ops)

-- 1. Add current_month to ai_cost_policies for Cron Reset logic
-- We use a simple TEXT column 'YYYY-MM' to track the accumulation period.
ALTER TABLE ai_cost_policies ADD COLUMN current_month TEXT DEFAULT NULL;

-- Backfill current_month for existing policies
UPDATE ai_cost_policies SET current_month = strftime('%Y-%m', 'now');

-- 2. Multi-Provider Placeholders (Enterprise Pack)
-- We update the 'Enterprise' pack to include inactive placeholders for OpenAI and Anthropic.
-- This ensures the system is "Multi-Provider Ready" without exposing keys or active routes.
UPDATE saas_policy_packs 
SET policies_json = '[
    {"task_type": "default", "mode": "fast", "provider": "cloudflare", "model": "@cf/meta/llama-3-8b-instruct", "priority": 10}, 
    {"task_type": "default", "mode": "smart", "provider": "cloudflare", "model": "@cf/meta/llama-3.1-70b-instruct", "priority": 10},
    {"task_type": "default", "mode": "smart", "provider": "openai", "model": "gpt-4o", "priority": 5, "is_active": 0},
    {"task_type": "default", "mode": "smart", "provider": "anthropic", "model": "claude-3-opus", "priority": 5, "is_active": 0}
]'
WHERE pack_name = 'Enterprise';
