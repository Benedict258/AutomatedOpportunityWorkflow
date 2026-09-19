import type { FastifyInstance } from 'fastify';
import { z } from 'zod';
import { getVerificationService } from '../services/verification.service';
import { 
  verificationRunSchema,
  createVerificationRunSchema,
  verificationFiltersSchema,
} from '../schemas/verification';
import { validateBody, validateParams, validateQuery } from '../middleware/validation';
import { authenticateRequest } from '../middleware/auth';
import { createSingleResponse, createListResponse } from '../utils/api-envelope';
import { AppError } from '../middleware/error';

export async function verificationRoutes(fastify: FastifyInstance): Promise<void> {
  const verificationService = getVerificationService();

  // Create verification run
  fastify.post('/api/v1/verification/runs', {
    preHandler: [authenticateRequest, validateBody(createVerificationRunSchema)],
    schema: {
      tags: ['Verification'],
      summary: 'Create a verification run',
      body: createVerificationRunSchema,
      response: {
        201: { type: 'object', properties: { data: verificationRunSchema } },
      },
    },
  }, async (request, reply) => {
    const run = await verificationService.create(request.body as z.infer<typeof createVerificationRunSchema>);
    reply.code(201).send(createSingleResponse(run));
  });

  // Get verification run status
  fastify.get('/api/v1/verification/runs/:runId', {
    preHandler: [authenticateRequest, validateParams(z.object({ runId: z.string().uuid() }))],
    schema: {
      tags: ['Verification'],
      summary: 'Get verification run status',
      params: z.object({ runId: z.string().uuid() }),
      response: {
        200: { type: 'object', properties: { data: verificationRunSchema } },
        404: { type: 'object', properties: { error: z.object({}) } },
      },
    },
  }, async (request, reply) => {
    const { runId } = request.params as { runId: string };
    const run = await verificationService.getById(runId);
    if (!run) {
      throw new AppError('Verification run not found', 404, 'NOT_FOUND');
    }
    return createSingleResponse(run);
  });

  // List verification runs
  fastify.get('/api/v1/verification/runs', {
    preHandler: [authenticateRequest, validateQuery(verificationFiltersSchema)],
    schema: {
      tags: ['Verification'],
      summary: 'List verification runs',
      query: verificationFiltersSchema,
      response: {
        200: { type: 'object', properties: { data: z.array(verificationRunSchema), meta: z.object({}), links: z.object({}).optional() } },
      },
    },
  }, async (request, reply) => {
    const filters = request.query as z.infer<typeof verificationFiltersSchema>;
    const { data, total } = await verificationService.list(filters);
    return createListResponse(data, filters.page, filters.limit, total, '/api/v1/verification/runs', request);
  });
}