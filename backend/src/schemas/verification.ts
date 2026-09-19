import { z } from 'zod';
import { paginationSchema, uuidSchema } from './discovery.js';

// Verification schemas
export const verificationStatusSchema = z.enum([
  'PENDING',
  'RUNNING',
  'SUCCEEDED',
  'FAILED',
  'PARTIAL',
  'CANCELLED',
]);

export const verificationRunSchema = z.object({
  id: uuidSchema,
  opportunityIds: z.array(uuidSchema),
  status: verificationStatusSchema,
  startedAt: z.string().datetime(),
  completedAt: z.string().datetime().optional(),
  results: z.array(z.object({
    opportunityId: uuidSchema,
    verified: z.boolean(),
    changes: z.array(z.string()).optional(),
    error: z.string().optional(),
  })).optional(),
  error: z.string().optional(),
  triggeredBy: z.string().optional(),
  metadata: z.record(z.unknown()).optional(),
  createdAt: z.string().datetime(),
  updatedAt: z.string().datetime(),
});

export const createVerificationRunSchema = z.object({
  opportunityIds: z.array(uuidSchema).min(1).max(1000),
  triggeredBy: z.string().optional(),
  metadata: z.record(z.unknown()).optional(),
});

export const verificationFiltersSchema = z.object({
  status: verificationStatusSchema.optional(),
  triggeredBy: z.string().optional(),
  dateFrom: z.string().datetime().optional(),
  dateTo: z.string().datetime().optional(),
}).merge(paginationSchema);

// Reprocessing schemas
export const reprocessingStatusSchema = z.enum([
  'PENDING',
  'RUNNING',
  'SUCCEEDED',
  'FAILED',
  'PARTIAL',
  'CANCELLED',
]);

export const reprocessingRunSchema = z.object({
  id: uuidSchema,
  opportunityIds: z.array(uuidSchema),
  status: reprocessingStatusSchema,
  startedAt: z.string().datetime(),
  completedAt: z.string().datetime().optional(),
  results: z.array(z.object({
    opportunityId: uuidSchema,
    reprocessed: z.boolean(),
    intelligenceUpdated: z.boolean(),
    error: z.string().optional(),
  })).optional(),
  error: z.string().optional(),
  triggeredBy: z.string().optional(),
  forceReprocess: z.boolean(),
  metadata: z.record(z.unknown()).optional(),
  createdAt: z.string().datetime(),
  updatedAt: z.string().datetime(),
});

export const createReprocessingRunSchema = z.object({
  opportunityIds: z.array(uuidSchema).min(1).max(1000),
  reason: z.string().optional(),
  triggeredBy: z.string().optional(),
  forceReprocess: z.boolean().default(false),
  metadata: z.record(z.unknown()).optional(),
});

export const reprocessingFiltersSchema = z.object({
  status: reprocessingStatusSchema.optional(),
  triggeredBy: z.string().optional(),
  dateFrom: z.string().datetime().optional(),
  dateTo: z.string().datetime().optional(),
}).merge(paginationSchema);

// Type exports
export type VerificationRun = z.infer<typeof verificationRunSchema>;
export type CreateVerificationRun = z.infer<typeof createVerificationRunSchema>;
export type VerificationFilters = z.infer<typeof verificationFiltersSchema>;
export type ReprocessingRun = z.infer<typeof reprocessingRunSchema>;
export type CreateReprocessingRun = z.infer<typeof createReprocessingRunSchema>;
export type ReprocessingFilters = z.infer<typeof reprocessingFiltersSchema>;