import type { FastifyInstance } from 'fastify';
import { z } from 'zod';
import { getReprocessingService } from '../services/reprocessing.service';
import { 
  reprocessingRunSchema,
  createReprocessingRunSchema,
  reprocessingFiltersSchema,
} from '../schemas/verification';
import { validateBody, validateParams, validateQuery } from '../middleware/validation';
import { authenticateRequest } from '../middleware/auth';
import { createSingleResponse, createListResponse } from '../utils/api-envelope';
import { AppError } from '../middleware/error';
import { zodToJson } from '../utils/schema-converter';

export async function reprocessingRoutes(fastify: FastifyInstance): Promise<void> {
  const reprocessingService = getReprocessingService();

  // Create reprocessing run
  fastify.post('/api/v1/reprocessing/runs', {
    preHandler: [authenticateRequest, validateBody(createReprocessingRunSchema)],
    schema: {
      tags: ['Reprocessing'],
      summary: 'Create a reprocessing run',
      body: zodToJson(createReprocessingRunSchema),
      response: {
        201: { type: 'object', properties: { data: zodToJson(reprocessingRunSchema) } },
      },
    },
  }, async (request, reply) => {
    const run = await reprocessingService.create(request.body as z.infer<typeof createReprocessingRunSchema>);
    reply.code(201).send(createSingleResponse(run));
  });

  // Get reprocessing run status
  fastify.get('/api/v1/reprocessing/runs/:runId', {
    preHandler: [authenticateRequest, validateParams(z.object({ runId: z.string().uuid() }))],
    schema: {
      tags: ['Reprocessing'],
      summary: 'Get reprocessing run status',
      params: zodToJson(z.object({ runId: z.string().uuid() })),
      response: {
        200: { type: 'object', properties: { data: zodToJson(reprocessingRunSchema) } },
        404: { type: 'object', properties: { error: zodToJson(z.object({})) } },
      },
    },
  }, async (request, reply) => {
    const { runId } = request.params as { runId: string };
    const run = await reprocessingService.getById(runId);
    if (!run) {
      throw new AppError('Reprocessing run not found', 404, 'NOT_FOUND');
    }
    return createSingleResponse(run);
  });

  // List reprocessing runs
  fastify.get('/api/v1/reprocessing/runs', {
    preHandler: [authenticateRequest, validateQuery(reprocessingFiltersSchema)],
    schema: {
      tags: ['Reprocessing'],
      summary: 'List reprocessing runs',
      query: zodToJson(reprocessingFiltersSchema),
      response: {
        200: { type: 'object', properties: { data: zodToJson(z.array(reprocessingRunSchema)), meta: zodToJson(z.object({})), links: zodToJson(z.object({}).optional()) } },
      },
    },
  }, async (request, reply) => {
    const filters = request.query as z.infer<typeof reprocessingFiltersSchema>;
    const { data, total } = await reprocessingService.list(filters);
    return createListResponse(data, filters.page, filters.limit, total, '/api/v1/reprocessing/runs', request);
  });
}