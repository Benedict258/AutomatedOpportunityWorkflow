import { z } from 'zod';
import { paginationSchema, uuidSchema, dateRangeSchema } from './discovery.js';

// Opportunity schemas
export const opportunityStatusSchema = z.enum([
  'ACTIVE',
  'CLOSED',
  'EXPIRED',
  'DRAFT',
  'ARCHIVED',
]);

export const deadlineTypeSchema = z.enum([
  'FIXED',
  'ROLLING',
  'ONGOING',
  'UNKNOWN',
]);

export const opportunitySchema = z.object({
  id: uuidSchema,
  stableId: uuidSchema,
  sourceId: uuidSchema,
  externalId: z.string().optional(),
  title: z.string().max(500),
  organization: z.string().max(255).optional(),
  description: z.string().optional(),
  url: z.string().url().optional(),
  location: z.string().max(255).optional(),
  remoteInfo: z.record(z.unknown()).optional(),
  opportunityType: z.string().max(100).optional(),
  categoryIds: z.array(uuidSchema).optional(),
  status: opportunityStatusSchema,
  publicationDate: z.string().datetime().optional(),
  applicationDeadline: z.string().datetime().nullable().optional(),
  deadlineType: deadlineTypeSchema,
  firstSeenAt: z.string().datetime(),
  lastSeenAt: z.string().datetime().optional(),
  lastVerifiedAt: z.string().datetime().optional(),
  closedAt: z.string().datetime().optional(),
  lifecycleStage: z.string().max(100).optional(),
  createdAt: z.string().datetime(),
  updatedAt: z.string().datetime(),
});

export const createOpportunitySchema = z.object({
  sourceId: uuidSchema,
  externalId: z.string().optional(),
  title: z.string().min(1).max(500),
  organization: z.string().max(255).optional(),
  description: z.string().optional(),
  url: z.string().url().optional(),
  location: z.string().max(255).optional(),
  remoteInfo: z.record(z.unknown()).optional(),
  opportunityType: z.string().max(100).optional(),
  categoryIds: z.array(uuidSchema).optional(),
  status: opportunityStatusSchema.default('ACTIVE'),
  publicationDate: z.string().datetime().optional(),
  applicationDeadline: z.string().datetime().nullable().optional(),
  deadlineType: deadlineTypeSchema.default('UNKNOWN'),
  lifecycleStage: z.string().max(100).optional(),
});

export const updateOpportunitySchema = createOpportunitySchema.partial();

export const opportunityFiltersSchema = z.object({
  category: z.string().optional(),
  status: opportunityStatusSchema.optional(),
  sourceId: uuidSchema.optional(),
  dateFrom: z.string().datetime().optional(),
  dateTo: z.string().datetime().optional(),
  search: z.string().optional(),
  hasDeadline: z.coerce.boolean().optional(),
}).merge(paginationSchema);

export const opportunityVersionSchema = z.object({
  id: uuidSchema,
  opportunityId: uuidSchema,
  versionNumber: z.number().int().positive(),
  capturedAt: z.string().datetime(),
  title: z.string().max(500).optional(),
  description: z.string().optional(),
  applicationDeadline: z.string().datetime().optional(),
  deadlineType: deadlineTypeSchema.optional(),
  location: z.string().max(255).optional(),
  url: z.string().url().optional(),
  status: opportunityStatusSchema.optional(),
  changeMetadata: z.record(z.unknown()).optional(),
  createdAt: z.string().datetime(),
});

// Intelligence schemas
export const opportunityClassificationSchema = z.object({
  primaryCategory: z.string(),
  secondaryCategories: z.array(z.string()).optional(),
  confidence: z.number().min(0).max(1),
  taxonomyPath: z.array(z.string()).optional(),
});

export const eligibilityRequirementSchema = z.object({
  id: uuidSchema,
  name: z.string(),
  requirementType: z.string(),
  value: z.string().optional(),
  details: z.record(z.unknown()).optional(),
  isRequired: z.boolean(),
  sourceEvidence: z.string().optional(),
});

export const eligibilityAssessmentSchema = z.object({
  opportunityId: uuidSchema,
  candidateId: uuidSchema,
  requirements: z.array(
    z.object({
      requirementId: uuidSchema,
      state: z.enum(['MET', 'NOT_MET', 'UNKNOWN', 'NOT_APPLICABLE']),
      notes: z.string().optional(),
    })
  ),
  overallEligible: z.boolean(),
  assessedAt: z.string().datetime(),
});

export const matchFactorSchema = z.object({
  name: z.string(),
  weight: z.number().min(0).max(1),
  score: z.number().min(0).max(1),
  evidence: z.string().optional(),
});

export const matchScoreSchema = z.object({
  overall: z.number().min(0).max(1),
  factors: z.array(matchFactorSchema),
  confidence: z.number().min(0).max(1),
});

export const rankingResultSchema = z.object({
  rank: z.number().int().positive(),
  score: z.number().min(0).max(1),
  percentile: z.number().min(0).max(100).optional(),
});

export const explanationSchema = z.object({
  summary: z.string(),
  strengths: z.array(z.string()),
  gaps: z.array(z.string()),
  recommendations: z.array(z.string()),
  detail: z.record(z.unknown()).optional(),
});

export const opportunityIntelligenceSchema = z.object({
  opportunityId: uuidSchema,
  classification: opportunityClassificationSchema,
  requirements: z.array(eligibilityRequirementSchema),
  eligibility: eligibilityAssessmentSchema.optional(),
  match: z.object({
    candidateId: uuidSchema,
    score: matchScoreSchema,
    ranking: rankingResultSchema,
  }).optional(),
  explanation: explanationSchema,
  scoredAt: z.string().datetime(),
  version: z.number().int().positive(),
});

// Type exports
export type Opportunity = z.infer<typeof opportunitySchema>;
export type CreateOpportunity = z.infer<typeof createOpportunitySchema>;
export type UpdateOpportunity = z.infer<typeof updateOpportunitySchema>;
export type OpportunityFilters = z.infer<typeof opportunityFiltersSchema>;
export type OpportunityVersion = z.infer<typeof opportunityVersionSchema>;
export type OpportunityIntelligence = z.infer<typeof opportunityIntelligenceSchema>;
export type OpportunityClassification = z.infer<typeof opportunityClassificationSchema>;
export type EligibilityAssessment = z.infer<typeof eligibilityAssessmentSchema>;
export type MatchScore = z.infer<typeof matchScoreSchema>;
export type Explanation = z.infer<typeof explanationSchema>;