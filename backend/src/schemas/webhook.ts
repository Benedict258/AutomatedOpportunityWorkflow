import { z } from 'zod';
import { uuidSchema } from './discovery.js';

// Webhook event schemas (n8n callbacks)
export const discoveryCompleteWebhookSchema = z.object({
  runId: uuidSchema,
  jobId: uuidSchema,
  status: z.enum(['SUCCEEDED', 'FAILED', 'PARTIAL', 'CANCELLED']),
  metrics: z.object({
    totalSources: z.number().int(),
    sourcesSucceeded: z.number().int(),
    sourcesFailed: z.number().int(),
    sourcesSkipped: z.number().int(),
    itemsDiscovered: z.number().int(),
    itemsDeduplicated: z.number().int(),
    durationMs: z.number().int(),
    errorsCount: z.number().int(),
    warningsCount: z.number().int(),
  }),
  opportunities: z.array(z.object({
    id: uuidSchema,
    stableId: uuidSchema,
    externalId: z.string(),
    title: z.string(),
    url: z.string().url().optional(),
  })).optional(),
  error: z.string().optional(),
  completedAt: z.string().datetime(),
});

export const intelligenceCompleteWebhookSchema = z.object({
  opportunityId: uuidSchema,
  runId: uuidSchema,
  status: z.enum(['SUCCEEDED', 'FAILED', 'PARTIAL']),
  intelligence: z.object({
    classification: z.object({
      primaryCategory: z.string(),
      secondaryCategories: z.array(z.string()).optional(),
      confidence: z.number().min(0).max(1),
    }).optional(),
    requirements: z.array(z.object({
      id: uuidSchema,
      name: z.string(),
      requirementType: z.string(),
      isRequired: z.boolean(),
    })).optional(),
    eligibility: z.object({
      overallEligible: z.boolean(),
      requirements: z.array(z.object({
        requirementId: uuidSchema,
        state: z.enum(['MET', 'NOT_MET', 'UNKNOWN', 'NOT_APPLICABLE']),
      })),
    }).optional(),
    explanation: z.object({
      summary: z.string(),
      strengths: z.array(z.string()),
      gaps: z.array(z.string()),
      recommendations: z.array(z.string()),
    }).optional(),
  }).optional(),
  error: z.string().optional(),
  completedAt: z.string().datetime(),
});

export const highPriorityAlertWebhookSchema = z.object({
  opportunityId: uuidSchema,
  alertType: z.enum(['DEADLINE_SOON', 'HIGH_MATCH', 'NEW_OPPORTUNITY', 'VERIFICATION_FAILED']),
  severity: z.enum(['LOW', 'MEDIUM', 'HIGH', 'CRITICAL']),
  message: z.string(),
  metadata: z.record(z.unknown()).optional(),
  triggeredAt: z.string().datetime(),
  candidateIds: z.array(uuidSchema).optional(),
});

export const applicationTrackingWebhookSchema = z.object({
  applicationId: uuidSchema,
  opportunityId: uuidSchema,
  candidateId: uuidSchema,
  event: z.enum([
    'CREATED',
    'SUBMITTED',
    'STATUS_CHANGED',
    'INTERVIEW_SCHEDULED',
    'OFFER_RECEIVED',
    'ACCEPTED',
    'REJECTED',
    'WITHDRAWN',
  ]),
  previousStatus: z.string().optional(),
  newStatus: z.string(),
  metadata: z.record(z.unknown()).optional(),
  occurredAt: z.string().datetime(),
});

export const discoveryManualTriggerSchema = z.object({
  jobId: uuidSchema.optional(),
  sourceIds: z.array(z.string()).optional(),
  runAllEnabled: z.boolean().default(false),
  category: z.string().optional(),
  priorityMin: z.number().int().min(0).max(100).optional(),
  triggeredBy: z.string().default('manual-webhook'),
  metadata: z.record(z.unknown()).optional(),
});

export const reprocessingManualTriggerSchema = z.object({
  opportunityIds: z.array(uuidSchema).min(1).max(1000),
  reason: z.string().optional(),
  triggeredBy: z.string().default('manual-webhook'),
  forceReprocess: z.boolean().default(false),
  metadata: z.record(z.unknown()).optional(),
});

export const verificationCompleteWebhookSchema = z.object({
  runId: uuidSchema,
  opportunityIds: z.array(uuidSchema),
  status: z.enum(['SUCCEEDED', 'FAILED', 'PARTIAL']),
  results: z.array(z.object({
    opportunityId: uuidSchema,
    verified: z.boolean(),
    changes: z.array(z.string()).optional(),
    error: z.string().optional(),
  })).optional(),
  error: z.string().optional(),
  completedAt: z.string().datetime(),
});

export const reprocessingCompleteWebhookSchema = z.object({
  runId: uuidSchema,
  opportunityIds: z.array(uuidSchema),
  status: z.enum(['SUCCEEDED', 'FAILED', 'PARTIAL']),
  results: z.array(z.object({
    opportunityId: uuidSchema,
    reprocessed: z.boolean(),
    intelligenceUpdated: z.boolean(),
    error: z.string().optional(),
  })).optional(),
  error: z.string().optional(),
  completedAt: z.string().datetime(),
});

// Webhook registration schema
export const webhookRegistrationSchema = z.object({
  url: z.string().url(),
  events: z.array(z.enum([
    'discovery.complete',
    'intelligence.complete',
    'verification.complete',
    'reprocessing.complete',
    'high_priority_alert',
    'application.tracking',
  ])).min(1),
  secret: z.string().min(32).optional(),
  active: z.boolean().default(true),
});

// Type exports
export type DiscoveryCompleteWebhook = z.infer<typeof discoveryCompleteWebhookSchema>;
export type IntelligenceCompleteWebhook = z.infer<typeof intelligenceCompleteWebhookSchema>;
export type HighPriorityAlertWebhook = z.infer<typeof highPriorityAlertWebhookSchema>;
export type ApplicationTrackingWebhook = z.infer<typeof applicationTrackingWebhookSchema>;
export type DiscoveryManualTrigger = z.infer<typeof discoveryManualTriggerSchema>;
export type ReprocessingManualTrigger = z.infer<typeof reprocessingManualTriggerSchema>;
export type VerificationCompleteWebhook = z.infer<typeof verificationCompleteWebhookSchema>;
export type ReprocessingCompleteWebhook = z.infer<typeof reprocessingCompleteWebhookSchema>;
export type WebhookRegistration = z.infer<typeof webhookRegistrationSchema>;