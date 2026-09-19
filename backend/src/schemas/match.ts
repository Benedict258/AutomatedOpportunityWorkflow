import { z } from 'zod';
import { paginationSchema, uuidSchema } from './discovery.js';

// Match schemas
export const matchStatusSchema = z.enum([
  'PENDING',
  'COMPUTED',
  'NOTIFIED',
  'APPLIED',
  'REJECTED',
  'EXPIRED',
]);

export const matchSchema = z.object({
  id: uuidSchema,
  candidateId: uuidSchema,
  opportunityId: uuidSchema,
  score: z.object({
    overall: z.number().min(0).max(1),
    factors: z.array(z.object({
      name: z.string(),
      weight: z.number().min(0).max(1),
      score: z.number().min(0).max(1),
      evidence: z.string().optional(),
    })),
    confidence: z.number().min(0).max(1),
  }),
  ranking: z.object({
    rank: z.number().int().positive(),
    score: z.number().min(0).max(1),
    percentile: z.number().min(0).max(100).optional(),
  }).optional(),
  explanation: z.object({
    summary: z.string(),
    strengths: z.array(z.string()),
    gaps: z.array(z.string()),
    recommendations: z.array(z.string()),
    detail: z.record(z.unknown()).optional(),
  }),
  status: matchStatusSchema.default('COMPUTED'),
  computedAt: z.string().datetime(),
  notifiedAt: z.string().datetime().optional(),
  createdAt: z.string().datetime(),
  updatedAt: z.string().datetime(),
});

export const matchFiltersSchema = z.object({
  candidateId: uuidSchema.optional(),
  opportunityId: uuidSchema.optional(),
  status: matchStatusSchema.optional(),
  minScore: z.coerce.number().min(0).max(1).optional(),
  maxScore: z.coerce.number().min(0).max(1).optional(),
  computedAfter: z.string().datetime().optional(),
  computedBefore: z.string().datetime().optional(),
}).merge(paginationSchema);

export const createMatchRequestSchema = z.object({
  candidateId: uuidSchema,
  opportunityIds: z.array(uuidSchema).min(1).max(100),
});

// Type exports
export type Match = z.infer<typeof matchSchema>;
export type MatchFilters = z.infer<typeof matchFiltersSchema>;
export type CreateMatchRequest = z.infer<typeof createMatchRequestSchema>;