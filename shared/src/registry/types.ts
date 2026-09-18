export enum SourceCategory {
  EMPLOYMENT = 'EMPLOYMENT',
  GOVERNMENT = 'GOVERNMENT',
  RESEARCH = 'RESEARCH',
  INTERNATIONAL = 'INTERNATIONAL',
  STUDENT = 'STUDENT',
  TECHNICAL = 'TECHNICAL',
  POLICY = 'POLICY',
  FELLOWSHIP = 'FELLOWSHIP',
  EVENT = 'EVENT',
  NEWS = 'NEWS',
  PROFESSIONAL_DEVELOPMENT = 'PROFESSIONAL_DEVELOPMENT',
}

export enum SourceType {
  API = 'API',
  RSS = 'RSS',
  SCRAPE = 'SCRAPE',
  MANUAL = 'MANUAL',
}

export enum AccessMethod {
  PUBLIC = 'PUBLIC',
  AUTHENTICATED = 'AUTHENTICATED',
  API_KEY = 'API_KEY',
  OAUTH = 'OAUTH',
}

export enum HealthStatus {
  HEALTHY = 'HEALTHY',
  DEGRADED = 'DEGRADED',
  UNREACHABLE = 'UNREACHABLE',
  DISABLED = 'DISABLED',
  UNKNOWN = 'UNKNOWN',
}

export interface SourceAuthentication {
  type: AccessMethod;
  requiresKey?: boolean;
  oauthScopes?: string[];
  notes?: string;
}

export interface SourceRateLimit {
  requestsPerMinute?: number;
  requestsPerHour?: number;
  requestsPerDay?: number;
  burst?: number;
}

export interface SourceCapabilities {
  pagination?: boolean;
  filtering?: boolean;
  fullTextSearch?: boolean;
  realTimeUpdates?: boolean;
  historicalData?: boolean;
}

export interface SourceMetadata {
  refreshFrequencyMinutes?: number;
  pagination?: {
    type: 'offset' | 'cursor' | 'page';
    pageSize?: number;
  };
  termsRestrictions?: string;
  healthStatus?: HealthStatus;
  sourceCapabilities?: SourceCapabilities;
  tags?: string[];
  notes?: string;
}

export interface SourceRegistryEntry {
  source_id: string;
  name: string;
  organization?: string;
  category: SourceCategory;
  geography?: string;
  source_type: SourceType;
  access_method: AccessMethod;
  api_endpoint?: string;
  authentication?: SourceAuthentication;
  rate_limit?: SourceRateLimit;
  cost?: 'FREE' | 'PAID' | 'FREEMIUM';
  reliability?: number; // 0-1 score
  priority: number; // 1-100, higher = more important
  enabled: boolean;
  last_success?: string; // ISO timestamp
  last_failure?: string; // ISO timestamp
  last_checked?: string; // ISO timestamp
  metadata?: SourceMetadata;
  url?: string; // maps to Source.domain
  sourceType?: string; // legacy
}
