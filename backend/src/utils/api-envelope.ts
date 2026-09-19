import type { FastifyRequest } from 'fastify';
import { z } from 'zod';

// Single item response envelope
export const singleResponseSchema = <T extends z.ZodTypeAny>(dataSchema: T) =>
  z.object({
    data: dataSchema,
  });

// List response envelope with pagination metadata
export const listResponseSchema = <T extends z.ZodTypeAny>(itemSchema: T) =>
  z.object({
    data: z.array(itemSchema),
    meta: z.object({
      page: z.number().int().positive(),
      limit: z.number().int().positive(),
      total: z.number().int().nonnegative(),
      totalPages: z.number().int().nonnegative(),
      hasNext: z.boolean(),
      hasPrev: z.boolean(),
    }),
    links: z.object({
      first: z.string().url().optional(),
      prev: z.string().url().optional(),
      next: z.string().url().optional(),
      last: z.string().url().optional(),
    }).optional(),
  });

// Error envelope
export const errorResponseSchema = z.object({
  error: z.object({
    code: z.string(),
    title: z.string(),
    message: z.string(),
    status: z.number().int(),
    requestId: z.string(),
    instance: z.string().optional(),
    details: z.array(z.object({
      field: z.string(),
      message: z.string(),
      code: z.string(),
    })).optional(),
  }),
});

// Type helpers
export type SingleResponse<T> = { data: T };
export type ListResponse<T> = {
  data: T[];
  meta: {
    page: number;
    limit: number;
    total: number;
    totalPages: number;
    hasNext: boolean;
    hasPrev: boolean;
  };
  links?: {
    first?: string;
    prev?: string;
    next?: string;
    last?: string;
  };
};
export type ErrorResponse = {
  error: {
    code: string;
    title: string;
    message: string;
    status: number;
    requestId: string;
    instance?: string;
    details?: Array<{ field: string; message: string; code: string }>;
  };
};

// Helper functions
export function createSingleResponse<T>(data: T): SingleResponse<T> {
  return { data };
}

export function createListResponse<T>(
  data: T[],
  page: number,
  limit: number,
  total: number,
  baseUrl: string,
  request: FastifyRequest
): ListResponse<T> {
  const totalPages = Math.ceil(total / limit);
  const hasNext = page < totalPages;
  const hasPrev = page > 1;

  const buildUrl = (p: number) => {
    const url = new URL(baseUrl, `http://${request.headers.host}`);
    url.searchParams.set('page', p.toString());
    url.searchParams.set('limit', limit.toString());
    // Preserve other query params
    for (const [key, value] of Object.entries(request.query as Record<string, string>)) {
      if (key !== 'page' && key !== 'limit' && value) {
        url.searchParams.set(key, value);
      }
    }
    return url.toString();
  };

  const links: ListResponse<T>['links'] = {
    first: buildUrl(1),
    last: buildUrl(totalPages),
  };

  if (hasPrev) links.prev = buildUrl(page - 1);
  if (hasNext) links.next = buildUrl(page + 1);

  return {
    data,
    meta: {
      page,
      limit,
      total,
      totalPages,
      hasNext,
      hasPrev,
    },
    links,
  };
}

export function createErrorResponse(
  code: string,
  title: string,
  message: string,
  status: number,
  requestId: string,
  instance?: string,
  details?: Array<{ field: string; message: string; code: string }>
): ErrorResponse {
  return {
    error: {
      code,
      title,
      message,
      status,
      requestId,
      instance,
      details,
    },
  };
}