export type FieldMapping = {
  sourceField: string;
  canonicalField: string;
  transform?: (value: unknown) => unknown;
  required?: boolean;
};

export type SourceMapper = {
  sourceId: string;
  sourceName?: string;
  mappings: FieldMapping[];
  defaultValues?: Record<string, unknown>;
  schemaVersion?: string;
};

export const FIELD_MAPPERS: Record<string, SourceMapper> = {
  greenhouse: {
    sourceId: 'greenhouse',
    sourceName: 'Greenhouse',
    schemaVersion: '1.0',
    mappings: [
      { sourceField: 'title', canonicalField: 'title', required: true },
      { sourceField: 'company_name', canonicalField: 'organization' },
      { sourceField: 'company', canonicalField: 'organization' },
      { sourceField: 'description', canonicalField: 'description' },
      { sourceField: 'job_description', canonicalField: 'description' },
      { sourceField: 'url', canonicalField: 'url' },
      { sourceField: 'apply_url', canonicalField: 'applicationUrl' },
      { sourceField: 'location', canonicalField: 'location' },
      { sourceField: 'office_location', canonicalField: 'location' },
      { sourceField: 'remote', canonicalField: 'remoteStatus', transform: (v) => mapRemoteStatus(v) },
      { sourceField: 'employment_type', canonicalField: 'opportunityType', transform: (v) => mapOpportunityType(v) },
      { sourceField: 'job_type', canonicalField: 'opportunityType', transform: (v) => mapOpportunityType(v) },
      { sourceField: 'categories', canonicalField: 'category' },
      { sourceField: 'department', canonicalField: 'category' },
      { sourceField: 'skills', canonicalField: 'skills' },
      { sourceField: 'requirements', canonicalField: 'experienceRequirements' },
      { sourceField: 'education', canonicalField: 'educationRequirements' },
      { sourceField: 'salary_min', canonicalField: 'compensation' },
      { sourceField: 'salary_max', canonicalField: 'compensation' },
      { sourceField: 'salary_currency', canonicalField: 'compensation' },
      { sourceField: 'posted_at', canonicalField: 'publicationDate', transform: (v) => normalizeDate(v) },
      { sourceField: 'posted_at', canonicalField: 'publicationDate', transform: (v) => normalizeDate(v) },
      { sourceField: 'deadline', canonicalField: 'deadline', transform: (v) => normalizeDate(v) },
      { sourceField: 'application_deadline', canonicalField: 'deadline', transform: (v) => normalizeDate(v) },
      { sourceField: 'external_id', canonicalField: 'externalId' },
      { sourceField: 'id', canonicalField: 'externalId' },
    ],
    defaultValues: {
      opportunityType: 'JOB',
      remoteStatus: 'UNKNOWN',
      deadlineType: 'UNKNOWN',
    },
  },

  usajobs: {
    sourceId: 'usajobs',
    sourceName: 'USA Jobs',
    schemaVersion: '1.0',
    mappings: [
      { sourceField: 'PositionTitle', canonicalField: 'title', required: true },
      { sourceField: 'OrganizationName', canonicalField: 'organization' },
      { sourceField: 'Organization', canonicalField: 'organization' },
      { sourceField: 'JobSummary', canonicalField: 'description' },
      { sourceField: 'PositionDescription', canonicalField: 'description' },
      { sourceField: 'PositionURI', canonicalField: 'url' },
      { sourceField: 'ApplicationCloseDate', canonicalField: 'deadline', transform: (v) => normalizeDate(v) },
      { sourceField: 'PublicationStartDate', canonicalField: 'publicationDate', transform: (v) => normalizeDate(v) },
      { sourceField: 'PositionLocation', canonicalField: 'location' },
      { sourceField: 'RemoteWork', canonicalField: 'remoteStatus', transform: (v) => mapRemoteStatus(v) },
      { sourceField: 'HiringPath', canonicalField: 'eligibility' },
      { sourceField: 'PayPlan', canonicalField: 'compensation' },
      { sourceField: 'Series', canonicalField: 'category' },
      { sourceField: 'PositionID', canonicalField: 'externalId' },
      { sourceField: 'JobAnnouncementNumber', canonicalField: 'externalId' },
    ],
    defaultValues: {
      opportunityType: 'JOB',
      remoteStatus: 'UNKNOWN',
      deadlineType: 'FIXED',
    },
  },

  eventbrite: {
    sourceId: 'eventbrite',
    sourceName: 'Eventbrite',
    schemaVersion: '1.0',
    mappings: [
      { sourceField: 'name', canonicalField: 'title', required: true },
      { sourceField: 'organizer_name', canonicalField: 'organization' },
      { sourceField: 'description', canonicalField: 'description' },
      { sourceField: 'url', canonicalField: 'url' },
      { sourceField: 'venue_address', canonicalField: 'location' },
      { sourceField: 'start_date', canonicalField: 'publicationDate', transform: (v) => normalizeDate(v) },
      { sourceField: 'registration_deadline', canonicalField: 'deadline', transform: (v) => normalizeDate(v) },
      { sourceField: 'event_id', canonicalField: 'externalId' },
      { sourceField: 'event_type', canonicalField: 'opportunityType', transform: (v) => mapOpportunityType(v) },
      { sourceField: 'categories', canonicalField: 'category' },
    ],
    defaultValues: {
      opportunityType: 'EVENT',
      remoteStatus: 'ONSITE',
      deadlineType: 'FIXED',
    },
  },

  rss_generic: {
    sourceId: 'rss_generic',
    sourceName: 'RSS Generic',
    schemaVersion: '1.0',
    mappings: [
      { sourceField: 'title', canonicalField: 'title', required: true },
      { sourceField: 'pubDate', canonicalField: 'publicationDate', transform: (v) => normalizeDate(v) },
      { sourceField: 'description', canonicalField: 'description' },
      { sourceField: 'link', canonicalField: 'url' },
      { sourceField: 'author', canonicalField: 'organization' },
      { sourceField: 'category', canonicalField: 'category' },
      { sourceField: 'guid', canonicalField: 'externalId' },
    ],
    defaultValues: {
      opportunityType: 'UNKNOWN',
      remoteStatus: 'UNKNOWN',
      deadlineType: 'UNKNOWN',
    },
  },
};

function mapRemoteStatus(value: unknown): string {
  if (!value) return 'UNKNOWN';
  const v = String(value).toLowerCase();
  if (['remote', 'fully remote', 'work from home'].includes(v)) return 'REMOTE';
  if (['hybrid', 'partially remote'].includes(v)) return 'HYBRID';
  if (['onsite', 'in office', 'on-site'].includes(v)) return 'ONSITE';
  if (['flexible'].includes(v)) return 'FLEXIBLE';
  return 'UNKNOWN';
}

function mapOpportunityType(value: unknown): string {
  if (!value) return 'UNKNOWN';
  const v = String(value).toLowerCase();
  if (v.includes('intern')) return 'INTERNSHIP';
  if (v.includes('fellow')) return 'FELLOWSHIP';
  if (v.includes('certif')) return 'CERTIFICATION';
  if (v.includes('event') || v.includes('conference')) return 'EVENT';
  if (v.includes('contract')) return 'CONTRACT';
  if (v.includes('volunteer')) return 'VOLUNTEER';
  return 'JOB';
}

function normalizeDate(value: unknown): string | undefined {
  if (!value) return undefined;
  try {
    const d = new Date(String(value));
    if (isNaN(d.getTime())) return undefined;
    return d.toISOString();
  } catch {
    return undefined;
  }
}

export function getMapper(sourceId: string): SourceMapper | undefined {
  return FIELD_MAPPERS[sourceId.toLowerCase()];
}

export function getAllMappers(): SourceMapper[] {
  return Object.values(FIELD_MAPPERS);
}
