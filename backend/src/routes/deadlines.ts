import type { FastifyInstance } from 'fastify';
import { z } from 'zod';
import { getOpportunityService } from '../services/opportunity.service';
import { paginationSchema, uuidSchema } from '../schemas/discovery';
import { validateParams, validateQuery } from '../middleware/validation';
import { authenticateRequest } from '../middleware/auth';
import { createSingleResponse, createListResponse } from '../utils/api-envelope';
import { AppError } from '../middleware/error';

const deadlineQuerySchema = paginationSchema.extend({
  windowDays: z.coerce.number().int().positive().default(30),
  category: z.string().optional(),
  status: z.string().optional(),
});

export async function deadlineRoutes(fastify: FastifyInstance): Promise<void> {
  const opportunityService = getOpportunityService();

  // Get upcoming deadlines
  fastify.get('/api/v1/deadlines/upcoming', {
    preHandler: [authenticateRequest, validateQuery(deadlineQuerySchema)],
    schema: {
      tags: ['Deadlines'],
      summary: 'Get upcoming deadlines',
      query: deadlineQuerySchema,
      response: {
        200: { type: 'object', properties: { data: z.array(z.object({})), meta: z.object({}), links: z.object({}).optional() } },
      },
    },
  }, async (request, reply) => {
    const { page = 1, limit = 20, windowDays = 30, category, status, sortBy = 'created_at', sortOrder = 'desc' } = request.query as z.infer<typeof deadlineQuerySchema>;
    
    // Query opportunities with deadlines in the window
    const { data: opportunities, total } = await opportunityService.list({
      page,
      limit,
      sortBy,
      sortOrder,
      category,
      status: status as any,
      hasDeadline: true,
      dateFrom: new Date().toISOString(),
      dateTo: new Date(Date.now() + windowDays * 24 * 60 * 60 * 1000).toISOString(),
    });

    // Transform to deadline format
    const deadlines = opportunities
      .filter((o: any) => o.applicationDeadline)
      .map((o: any) => ({
        id: o.id,
        opportunityId: o.id,
        opportunityTitle: o.title,
        deadline: o.applicationDeadline,
        deadlineType: o.deadlineType,
        daysUntil: Math.ceil((new Date(o.applicationDeadline).getTime() - Date.now()) / (1000 * 60 * 60 * 24)),
        organization: o.organization,
        url: o.url,
      }))
      .sort((a: any, b: any) => new Date(a.deadline).getTime() - new Date(b.deadline).getTime());

    return createListResponse(deadlines, page, limit, total, '/api/v1/deadlines/upcoming', request);
  });
}