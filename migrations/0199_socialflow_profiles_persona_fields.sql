-- Applies to: SOCIAL_DB (saas_socialflows_prod_db)
-- Adds influencer/empresa persona + growth-goal fields to socialflow_profiles,
-- plus the real posting cadence used by StyleLearningAgent and caption generation.
ALTER TABLE socialflow_profiles ADD COLUMN age_range TEXT;
ALTER TABLE socialflow_profiles ADD COLUMN gender TEXT;
ALTER TABLE socialflow_profiles ADD COLUMN growth_goal_followers INTEGER;
ALTER TABLE socialflow_profiles ADD COLUMN growth_goal_timeline TEXT;
ALTER TABLE socialflow_profiles ADD COLUMN content_style TEXT;
ALTER TABLE socialflow_profiles ADD COLUMN posting_frequency INTEGER;
