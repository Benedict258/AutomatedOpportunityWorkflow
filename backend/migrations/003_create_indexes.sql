-- Indexes for performance and query optimization

-- Users
CREATE INDEX IF NOT EXISTS idx_users_email ON users(email);

-- Candidate Profiles
CREATE INDEX IF NOT EXISTS idx_candidate_profiles_user_id ON candidate_profiles(user_id);

-- Sources
CREATE INDEX IF NOT EXISTS idx_sources_name ON sources(name);

-- Opportunities
CREATE INDEX IF NOT EXISTS idx_opportunities_stable_id ON opportunities(stable_id);
CREATE INDEX IF NOT EXISTS idx_opportunities_source_external ON opportunities(source_id, external_id);
CREATE INDEX IF NOT EXISTS idx_opportunities_deadline ON opportunities(application_deadline) WHERE application_deadline IS NOT NULL;
CREATE INDEX IF NOT EXISTS idx_opportunities_status ON opportunities(status);
CREATE INDEX IF NOT EXISTS idx_opportunities_organization ON opportunities(organization);
CREATE INDEX IF NOT EXISTS idx_opportunities_category ON opportunities USING GIN (category_ids);
CREATE INDEX IF NOT EXISTS idx_opportunities_location ON opportunities(location);
CREATE INDEX IF NOT EXISTS idx_opportunities_created_at ON opportunities(created_at);
CREATE INDEX IF NOT EXISTS idx_opportunities_first_seen ON opportunities(first_seen_at);
CREATE INDEX IF NOT EXISTS idx_opportunities_last_seen ON opportunities(last_seen_at);
CREATE INDEX IF NOT EXISTS idx_opportunities_embedding ON opportunities USING ivfflat (embedding vector_cosine_ops) WITH (lists = 100);

-- Opportunity Versions
CREATE INDEX IF NOT EXISTS idx_opportunity_versions_opportunity_id ON opportunity_versions(opportunity_id);

-- Opportunity Categories
CREATE INDEX IF NOT EXISTS idx_opportunity_categories_parent ON opportunity_categories(parent_id);

-- Skills
CREATE INDEX IF NOT EXISTS idx_skills_normalized_name ON skills(normalized_name);

-- Opportunity Skills
CREATE INDEX IF NOT EXISTS idx_opportunity_skills_opportunity ON opportunity_skills(opportunity_id);
CREATE INDEX IF NOT EXISTS idx_opportunity_skills_skill ON opportunity_skills(skill_id);

-- Eligibility
CREATE INDEX IF NOT EXISTS idx_opportunity_eligibility_opportunity ON opportunity_eligibility(opportunity_id);
CREATE INDEX IF NOT EXISTS idx_opportunity_eligibility_requirement ON opportunity_eligibility(requirement_id);

-- Duplicates
CREATE INDEX IF NOT EXISTS idx_duplicate_groups_fingerprint ON duplicate_groups(fingerprint);
CREATE INDEX IF NOT EXISTS idx_duplicate_members_opportunity ON duplicate_members(opportunity_id);

-- News
CREATE INDEX IF NOT EXISTS idx_news_items_source ON news_items(source_id);
CREATE INDEX IF NOT EXISTS idx_news_items_published ON news_items(published_at);
CREATE INDEX IF NOT EXISTS idx_news_items_topic ON news_items(topic);

-- Events
CREATE INDEX IF NOT EXISTS idx_events_start_date ON events(start_date);
CREATE INDEX IF NOT EXISTS idx_events_source ON events(source_id);

-- Notifications
CREATE INDEX IF NOT EXISTS idx_notifications_user_id ON notifications(user_id);
CREATE INDEX IF NOT EXISTS idx_notifications_status ON notifications(status);
CREATE INDEX IF NOT EXISTS idx_notifications_scheduled ON notifications(scheduled_at);

-- Notification History
CREATE INDEX IF NOT EXISTS idx_notification_history_notification ON notification_history(notification_id);
CREATE INDEX IF NOT EXISTS idx_notification_history_user ON notification_history(user_id);

-- Application References
CREATE INDEX IF NOT EXISTS idx_application_references_opportunity ON application_references(opportunity_id);
CREATE INDEX IF NOT EXISTS idx_application_references_user ON application_references(user_id);

-- System Configuration
CREATE INDEX IF NOT EXISTS idx_system_configurations_key ON system_configurations(key);

-- Benchmark
CREATE INDEX IF NOT EXISTS idx_benchmark_results_sample ON benchmark_results(sample_id);
