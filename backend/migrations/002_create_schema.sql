-- Create schema for Automated Opportunity Intelligence System
-- Compatible with domain model in shared/src/domain/

-- Enable required extensions
CREATE EXTENSION IF NOT EXISTS pgcrypto;

-- Users
CREATE TABLE IF NOT EXISTS users (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    email VARCHAR(255) NOT NULL UNIQUE,
    name VARCHAR(255) NOT NULL,
    created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

-- Candidate Profiles
CREATE TABLE IF NOT EXISTS candidate_profiles (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    user_id UUID NOT NULL REFERENCES users(id) ON DELETE CASCADE,
    education JSONB DEFAULT '[]'::JSONB,
    skills TEXT[],
    experience JSONB DEFAULT '[]'::JSONB,
    projects JSONB DEFAULT '[]'::JSONB,
    certifications UUID[],
    career_targets TEXT[],
    sectors TEXT[],
    preferred_locations TEXT[],
    remote_preference VARCHAR(20) CHECK (remote_preference IN ('REMOTE','HYBRID','ONSITE','FLEXIBLE')),
    work_authorization TEXT,
    eligibility_info JSONB,
    opportunity_preferences JSONB,
    professional_development_preferences JSONB,
    government_interests TEXT[],
    policy_interests TEXT[],
    international_affairs_interests TEXT[],
    created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    CONSTRAINT candidate_profiles_user_unique UNIQUE (user_id)
);

-- Sources
CREATE TABLE IF NOT EXISTS sources (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    name VARCHAR(255) NOT NULL,
    url TEXT,
    source_type VARCHAR(100),
    metadata JSONB,
    created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

-- Opportunity Categories
CREATE TABLE IF NOT EXISTS opportunity_categories (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    name VARCHAR(255) NOT NULL UNIQUE,
    parent_id UUID REFERENCES opportunity_categories(id) ON DELETE SET NULL,
    metadata JSONB,
    created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

-- Opportunities
CREATE TABLE IF NOT EXISTS opportunities (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    stable_id UUID NOT NULL UNIQUE DEFAULT gen_random_uuid(),
    source_id UUID NOT NULL REFERENCES sources(id) ON DELETE RESTRICT,
    external_id VARCHAR(255),
    title VARCHAR(500) NOT NULL,
    organization VARCHAR(255),
    description TEXT,
    url TEXT,
    location VARCHAR(255),
    remote_info JSONB,
    opportunity_type VARCHAR(100),
    category_ids UUID[],
    status VARCHAR(100) NOT NULL,
    publication_date TIMESTAMPTZ,
    application_deadline TIMESTAMPTZ,
    deadline_type VARCHAR(50) NOT NULL,
    first_seen_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    last_seen_at TIMESTAMPTZ,
    last_verified_at TIMESTAMPTZ,
    closed_at TIMESTAMPTZ,
    lifecycle_stage VARCHAR(100),
    embedding VECTOR(1536), -- Configurable dimension placeholder
    created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    CONSTRAINT opportunities_source_external_unique UNIQUE (source_id, external_id)
);

-- Opportunity Versions
CREATE TABLE IF NOT EXISTS opportunity_versions (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    opportunity_id UUID NOT NULL REFERENCES opportunities(id) ON DELETE CASCADE,
    version_number INTEGER NOT NULL,
    captured_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    title VARCHAR(500),
    description TEXT,
    application_deadline TIMESTAMPTZ,
    deadline_type VARCHAR(50),
    location VARCHAR(255),
    url TEXT,
    status VARCHAR(100),
    change_metadata JSONB,
    created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    CONSTRAINT opportunity_versions_unique UNIQUE (opportunity_id, version_number)
);

-- Skills
CREATE TABLE IF NOT EXISTS skills (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    name VARCHAR(255) NOT NULL,
    normalized_name VARCHAR(255),
    description TEXT,
    category VARCHAR(100),
    created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    CONSTRAINT skills_name_unique UNIQUE (name)
);

-- Opportunity Skills
CREATE TABLE IF NOT EXISTS opportunity_skills (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    opportunity_id UUID NOT NULL REFERENCES opportunities(id) ON DELETE CASCADE,
    skill_id UUID NOT NULL REFERENCES skills(id) ON DELETE CASCADE,
    relation_type VARCHAR(50) NOT NULL,
    proficiency_context TEXT,
    created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    CONSTRAINT opportunity_skills_unique UNIQUE (opportunity_id, skill_id, relation_type)
);

-- Eligibility Requirements
CREATE TABLE IF NOT EXISTS eligibility_requirements (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    name VARCHAR(255) NOT NULL,
    requirement_type VARCHAR(100) NOT NULL,
    value TEXT,
    details JSONB,
    is_required BOOLEAN NOT NULL DEFAULT TRUE,
    source_evidence TEXT,
    created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

-- Opportunity Eligibility
CREATE TABLE IF NOT EXISTS opportunity_eligibility (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    opportunity_id UUID NOT NULL REFERENCES opportunities(id) ON DELETE CASCADE,
    requirement_id UUID NOT NULL REFERENCES eligibility_requirements(id) ON DELETE CASCADE,
    eligibility_state VARCHAR(50) NOT NULL,
    notes TEXT,
    created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    CONSTRAINT opportunity_eligibility_unique UNIQUE (opportunity_id, requirement_id)
);

-- Duplicate Groups
CREATE TABLE IF NOT EXISTS duplicate_groups (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    fingerprint TEXT,
    canonical_opportunity_id UUID REFERENCES opportunities(id) ON DELETE SET NULL,
    duplicate_state VARCHAR(50) NOT NULL,
    metadata JSONB,
    created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

-- Duplicate Members
CREATE TABLE IF NOT EXISTS duplicate_members (
    group_id UUID NOT NULL REFERENCES duplicate_groups(id) ON DELETE CASCADE,
    opportunity_id UUID NOT NULL REFERENCES opportunities(id) ON DELETE CASCADE,
    duplicate_state VARCHAR(50) NOT NULL,
    created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    PRIMARY KEY (group_id, opportunity_id)
);

-- News Items
CREATE TABLE IF NOT EXISTS news_items (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    title VARCHAR(500) NOT NULL,
    source_id UUID NOT NULL REFERENCES sources(id) ON DELETE RESTRICT,
    url TEXT,
    summary TEXT,
    published_at TIMESTAMPTZ,
    discovered_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    topic VARCHAR(255),
    organization VARCHAR(255),
    sector VARCHAR(255),
    geography VARCHAR(255),
    relevance NUMERIC,
    related_opportunity_ids UUID[],
    created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

-- Events
CREATE TABLE IF NOT EXISTS events (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    name VARCHAR(500) NOT NULL,
    organizer VARCHAR(255),
    description TEXT,
    url TEXT,
    event_type VARCHAR(100),
    location VARCHAR(255),
    remote_info JSONB,
    start_date TIMESTAMPTZ,
    end_date TIMESTAMPTZ,
    registration_deadline TIMESTAMPTZ,
    source_id UUID REFERENCES sources(id) ON DELETE SET NULL,
    status VARCHAR(100),
    created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

-- Certifications
CREATE TABLE IF NOT EXISTS certifications (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    provider VARCHAR(255),
    title VARCHAR(500) NOT NULL,
    description TEXT,
    url TEXT,
    category VARCHAR(100),
    cost_info TEXT,
    deadline TIMESTAMPTZ,
    duration VARCHAR(100),
    eligibility TEXT,
    status VARCHAR(100),
    source_id UUID REFERENCES sources(id) ON DELETE SET NULL,
    created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

-- Fellowships
CREATE TABLE IF NOT EXISTS fellowships (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    name VARCHAR(500) NOT NULL,
    organization VARCHAR(255),
    description TEXT,
    url TEXT,
    fellowship_type VARCHAR(100),
    location VARCHAR(255),
    remote_info JSONB,
    deadline TIMESTAMPTZ,
    eligibility TEXT,
    duration VARCHAR(100),
    stipend_info TEXT,
    source_id UUID REFERENCES sources(id) ON DELETE SET NULL,
    status VARCHAR(100),
    created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

-- Notifications
CREATE TABLE IF NOT EXISTS notifications (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    user_id UUID NOT NULL REFERENCES users(id) ON DELETE CASCADE,
    type VARCHAR(100) NOT NULL,
    title VARCHAR(500) NOT NULL,
    message TEXT NOT NULL,
    related_entity_type VARCHAR(100),
    related_entity_id UUID,
    scheduled_at TIMESTAMPTZ,
    sent_at TIMESTAMPTZ,
    status VARCHAR(50) NOT NULL,
    created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

-- Notification History
CREATE TABLE IF NOT EXISTS notification_history (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    notification_id UUID NOT NULL REFERENCES notifications(id) ON DELETE CASCADE,
    user_id UUID NOT NULL REFERENCES users(id) ON DELETE CASCADE,
    channel VARCHAR(100) NOT NULL,
    sent_at TIMESTAMPTZ,
    delivery_status VARCHAR(50) NOT NULL,
    error_info TEXT,
    created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

-- Application References
CREATE TABLE IF NOT EXISTS application_references (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    opportunity_id UUID NOT NULL REFERENCES opportunities(id) ON DELETE CASCADE,
    user_id UUID NOT NULL REFERENCES users(id) ON DELETE CASCADE,
    external_id VARCHAR(255),
    application_url TEXT,
    status VARCHAR(100),
    notes TEXT,
    metadata JSONB,
    created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    CONSTRAINT application_references_unique UNIQUE (opportunity_id, user_id)
);

-- System Configuration
CREATE TABLE IF NOT EXISTS system_configurations (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    key VARCHAR(255) NOT NULL UNIQUE,
    value JSONB,
    description TEXT,
    metadata JSONB,
    created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

-- Benchmark Samples
CREATE TABLE IF NOT EXISTS benchmark_samples (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    source_data JSONB,
    expected_extraction JSONB,
    expected_classification JSONB,
    expected_eligibility JSONB,
    expected_relevance NUMERIC,
    category VARCHAR(100),
    metadata JSONB,
    created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

-- Benchmark Results
CREATE TABLE IF NOT EXISTS benchmark_results (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    sample_id UUID NOT NULL REFERENCES benchmark_samples(id) ON DELETE CASCADE,
    model_task VARCHAR(100),
    accuracy NUMERIC,
    json_validity BOOLEAN,
    hallucination_indicators TEXT[],
    latency_ms INTEGER,
    token_usage JSONB,
    cost NUMERIC,
    evaluation_timestamp TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);
