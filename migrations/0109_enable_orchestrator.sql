-- Migration: 0109_enable_orchestrator.sql
-- Description: Adds materialization_step to tenants table for Orchestrator Gatekeeper.

-- 0 = Registered (Init)
-- 1 = Form Completed
-- 2 = Analysis Done
-- 3 = Plan Generated
-- 4 = Active / 30 Days

ALTER TABLE tenants ADD COLUMN materialization_step INTEGER NOT NULL DEFAULT 0;
