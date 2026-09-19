import { z } from 'zod';

// Common schemas
export const uuidSchema = z.string().uuid();
export const paginationSchema = z.object({
  page: z.coerce.number().int().positive().default(1),
  limit: z.coerce.number().int().positive().max(100).default(20),
  sortBy: z.string().optional(),
  sortOrder: z.enum(['asc', 'desc']).default('desc'),
});

export const dateRangeSchema = z.object({
  from: z.string().datetime().optional(),
  to: z.string().datetime().optional(),
});

// Discovery schemas
export const createJobOptionsSchema = z.object({
  sourceIds: z.array(z.string()).optional(),
  runAllEnabled: z.boolean().default(false),
  category: z.string().optional(),
  priorityMin: z.number().int().min(0).max(100).optional(),
  metadata: z.record(z.unknown()).optional(),
  triggeredBy: z.string().optional(),
});

export const discoveryJobSchema = z.object({
  jobId: uuidSchema,
  createdAt: z.string().datetime(),
  updatedAt: z.string().datetime(),
  sourceIds: z.array(z.string()).optional(),
  runAllEnabled: z.boolean(),
  category: z.string().optional(),
  priorityMin: z.number().int().min(0).max(100).optional(),
  metadata: z.record(z.unknown()).optional(),
  triggeredBy: z.string().optional(),
  status: z.enum(['DRAFT', 'SCHEDULED', 'PROCESSING', 'COMPLETED']),
});

export const discoveryRunSchema = z.object({
  runId: uuidSchema,
  jobId: uuidSchema,
  status: z.enum(['PENDING', 'RUNNING', 'SUCCEEDED', 'FAILED', 'CANCELLED', 'PARTIAL']),
  startedAt: z.string().datetime().optional(),
  completedAt: z.string().datetime().optional(),
  sourcesRequested: z.number().int(),
  sourcesSucceeded: z.number().int(),
  sourcesFailed: z.number().int(),
  sourcesSkipped: z.number().int(),
  stageResults: z.array(z.unknown()),
  error: z.string().optional(),
  metadata: z.record(z.unknown()).optional(),
  executionContext: z.unknown(),
});

export const runScheduleRequestSchema = z.object({
  runId: uuidSchema.optional(),
  jobId: uuidSchema,
  sources: z.array(z.string()).min(1),
  scheduleAt: z.string().datetime().optional(),
  cronExpression: z.string().optional(),
  metadata: z.record(z.unknown()).optional(),
  triggeredBy: z.string().optional(),
});

export const runCancelRequestSchema = z.object({
  runId: uuidSchema,
  reason: z.string().optional(),
});

export const runPollOptionsSchema = z.object({
  runId: uuidSchema,
  intervalMs: z.coerce.number().int().positive().default(1000),
  timeoutMs: z.coerce.number().int().positive().default(60000),
});

// Type exports
export type CreateJobOptions = z.infer<typeof createJobOptionsSchema>;
export type DiscoveryJob = z.infer<typeof discoveryJobSchema>;
export type DiscoveryRun = z.infer<typeof discoveryRunSchema>;
export type RunScheduleRequest = z.infer<typeof runScheduleRequestSchema>;
export type RunCancelRequest = z.infer<typeof runCancelRequestSchema>;
export type RunPollOptions = z.infer<typeof runPollOptionsSchema>;