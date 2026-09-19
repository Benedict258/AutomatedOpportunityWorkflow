import { z } from 'zod';
import { paginationSchema, uuidSchema } from './discovery.js';

// Application schemas
export const applicationStatusSchema = z.enum([
  'DRAFT',
  'SUBMITTED',
  'UNDER_REVIEW',
  'INTERVIEWING',
  'OFFERED',
  'ACCEPTED',
  'REJECTED',
  'WITHDRAWN',
  'EXPIRED',
]);

export const applicationSchema = z.object({
  id: uuidSchema,
  opportunityId: uuidSchema,
  userId: uuidSchema,
  externalId: z.string().optional(),
  applicationUrl: z.string().url().optional(),
  status: applicationStatusSchema.default('DRAFT'),
  notes: z.string().optional(),
  metadata: z.record(z.unknown()).optional(),
  createdAt: z.string().datetime(),
  updatedAt: z.string().datetime(),
});

export const createApplicationSchema = z.object({
  opportunityId: uuidSchema,
  externalId: z.string().optional(),
  applicationUrl: z.string().url().optional(),
  status: applicationStatusSchema.default('DRAFT'),
  notes: z.string().optional(),
  metadata: z.record(z.unknown()).optional(),
});

export const updateApplicationSchema = z.object({
  status: applicationStatusSchema.optional(),
  notes: z.string().optional(),
  metadata: z.record(z.unknown()).optional(),
});

export const applicationFiltersSchema = z.object({
  opportunityId: uuidSchema.optional(),
  userId: uuidSchema.optional(),
  status: applicationStatusSchema.optional(),
  dateFrom: z.string().datetime().optional(),
  dateTo: z.string().datetime().optional(),
}).merge(paginationSchema);

// Reminder schemas
export const reminderSchema = z.object({
  id: uuidSchema,
  applicationId: uuidSchema,
  type: z.enum(['DEADLINE', 'FOLLOW_UP', 'INTERVIEW', 'CUSTOM']),
  scheduledAt: z.string().datetime(),
  sentAt: z.string().datetime().optional(),
  status: z.enum(['PENDING', 'SENT', 'FAILED', 'CANCELLED']),
  channel: z.enum(['EMAIL', 'PUSH', 'SMS', 'WEBHOOK']),
  error: z.string().optional(),
  createdAt: z.string().datetime(),
});

export const sendReminderRequestSchema = z.object({
  type: z.enum(['DEADLINE', 'FOLLOW_UP', 'INTERVIEW', 'CUSTOM']),
  scheduledAt: z.string().datetime().optional(), // If not provided, send immediately
  channel: z.enum(['EMAIL', 'PUSH', 'SMS', 'WEBHOOK']).default('EMAIL'),
  customMessage: z.string().optional(),
});

// Type exports
export type Application = z.infer<typeof applicationSchema>;
export type CreateApplication = z.infer<typeof createApplicationSchema>;
export type UpdateApplication = z.infer<typeof updateApplicationSchema>;
export type ApplicationFilters = z.infer<typeof applicationFiltersSchema>;
export type Reminder = z.infer<typeof reminderSchema>;
export type SendReminderRequest = z.infer<typeof sendReminderRequestSchema>;