-- Migration: Fix UUID Defaults
-- All tables need gen_random_uuid() as default for id columns
-- This ensures INSERT without explicit id works correctly

ALTER TABLE agents ALTER COLUMN id SET DEFAULT gen_random_uuid();
ALTER TABLE categories ALTER COLUMN id SET DEFAULT gen_random_uuid();
ALTER TABLE clip_variants ALTER COLUMN id SET DEFAULT gen_random_uuid();
ALTER TABLE clip_votes ALTER COLUMN id SET DEFAULT gen_random_uuid();
ALTER TABLE comments ALTER COLUMN id SET DEFAULT gen_random_uuid();
ALTER TABLE episodes ALTER COLUMN id SET DEFAULT gen_random_uuid();
ALTER TABLE follows ALTER COLUMN id SET DEFAULT gen_random_uuid();
ALTER TABLE limited_series ALTER COLUMN id SET DEFAULT gen_random_uuid();
ALTER TABLE notifications ALTER COLUMN id SET DEFAULT gen_random_uuid();
ALTER TABLE posts ALTER COLUMN id SET DEFAULT gen_random_uuid();
ALTER TABLE production_assets ALTER COLUMN id SET DEFAULT gen_random_uuid();
ALTER TABLE production_collaborators ALTER COLUMN id SET DEFAULT gen_random_uuid();
ALTER TABLE productions ALTER COLUMN id SET DEFAULT gen_random_uuid();
ALTER TABLE script_votes ALTER COLUMN id SET DEFAULT gen_random_uuid();
ALTER TABLE scripts ALTER COLUMN id SET DEFAULT gen_random_uuid();
ALTER TABLE shots ALTER COLUMN id SET DEFAULT gen_random_uuid();
ALTER TABLE studios ALTER COLUMN id SET DEFAULT gen_random_uuid();
ALTER TABLE submolt_moderators ALTER COLUMN id SET DEFAULT gen_random_uuid();
ALTER TABLE submolts ALTER COLUMN id SET DEFAULT gen_random_uuid();
ALTER TABLE subscriptions ALTER COLUMN id SET DEFAULT gen_random_uuid();
ALTER TABLE votes ALTER COLUMN id SET DEFAULT gen_random_uuid();
ALTER TABLE voting_periods ALTER COLUMN id SET DEFAULT gen_random_uuid();
