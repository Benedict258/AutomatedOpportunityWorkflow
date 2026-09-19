import { z } from 'zod';
import { paginationSchema, uuidSchema, dateRangeSchema } from './discovery.js';

// News schemas
export const newsItemSchema = z.object({
  id: uuidSchema,
  title: z.string().max(500),
  sourceId: uuidSchema,
  url: z.string().url().optional(),
  summary: z.string().optional(),
  publishedAt: z.string().datetime().optional(),
  discoveredAt: z.string().datetime(),
  topic: z.string().max(255).optional(),
  organization: z.string().max(255).optional(),
  sector: z.string().max(255).optional(),
  geography: z.string().max(255).optional(),
  relevance: z.number().min(0).max(1).optional(),
  relatedOpportunityIds: z.array(uuidSchema).optional(),
  createdAt: z.string().datetime(),
  updatedAt: z.string().datetime(),
});

export const createNewsItemSchema = z.object({
  title: z.string().min(1).max(500),
  sourceId: uuidSchema,
  url: z.string().url().optional(),
  summary: z.string().optional(),
  publishedAt: z.string().datetime().optional(),
  topic: z.string().max(255).optional(),
  organization: z.string().max(255).optional(),
  sector: z.string().max(255).optional(),
  geography: z.string().max(255).optional(),
  relevance: z.number().min(0).max(1).optional(),
  relatedOpportunityIds: z.array(uuidSchema).optional(),
});

export const updateNewsItemSchema = createNewsItemSchema.partial();

export const newsFiltersSchema = z.object({
  topic: z.string().optional(),
  sourceId: uuidSchema.optional(),
  organization: z.string().optional(),
  sector: z.string().optional(),
  geography: z.string().optional(),
  dateFrom: z.string().datetime().optional(),
  dateTo: z.string().datetime().optional(),
  minRelevance: z.coerce.number().min(0).max(1).optional(),
}).merge(paginationSchema);

// Type exports
export type NewsItem = z.infer<typeof newsItemSchema>;
export type CreateNewsItem = z.infer<typeof createNewsItemSchema>;
export type UpdateNewsItem = z.infer<typeof updateNewsItemSchema>;
export type NewsFilters = z.infer<typeof newsFiltersSchema>;