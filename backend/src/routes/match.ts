import type { FastifyInstance } from 'fastify';
import { z } from 'zod';
import { getMatchService } from '../services/match.service';
import { 
  matchSchema,
  matchFiltersSchema,
  createMatchRequestSchema,
} from '../schemas/match';
import { validateBody, validateParams, validateQuery } from '../middleware/validation';
import { authenticateRequest, requireCandidateAccess } from '../middleware/auth';
import { createSingleResponse, createListResponse } from '../utils/api-envelope';
import { AppError } from '../middleware/error';

export async function matchRoutes(fastify: FastifyInstance): Promise<void> {
  const matchService = getMatchService();

  // Create matches for candidate
  fastify.post('/api/v1/matches', {
    preHandler: [authenticateRequest, validateBody(createMatchRequestSchema)],
    schema: {
      tags: ['Matches'],
      summary: 'Create matches for a candidate',
      description: 'Runs matching algorithm for candidate against specified opportunities',
      body: createMatchRequestSchema,
      response: {
        202: { type: 'object', properties: { data: z.array(matchSchema) } },
      },
    },
  }, async (request, reply) => {
    const matches = await matchService.createMatchesForCandidate(request.body as z.infer<typeof createMatchRequestSchema>);
    reply.code(202).send(createSingleResponse(matches));
  });

  // List matches
  fastify.get('/api/v1/matches', {
    preHandler: [authenticateRequest, validateQuery(matchFiltersSchema)],
    schema: {
      tags: ['Matches'],
      summary: 'List matches',
      query: matchFiltersSchema,
      response: {
        200: { type: 'object', properties: { data: z.array(matchSchema), meta: z.object({}), links: z.object({}).optional() } },
      },
    },
  }, async (request, reply) => {
    const filters = request.query as z.infer<typeof matchFiltersSchema>;
    const { data, total } = await matchService.list(filters);
    return createListResponse(data, filters.page, filters.limit, total, '/api/v1/matches', request);
  });

  // Get match by ID
  fastify.get('/api/v1/matches/:id', {
    preHandler: [authenticateRequest, validateParams(z.object({ id: z.string().uuid() }))],
    schema: {
      tags: ['Matches'],
      summary: 'Get match details',
      params: z.object({ id: z.string().uuid() }),
      response: {
        200: { type: 'object', properties: { data: matchSchema } },
        404: { type: 'object', properties: { error: z.object({}) } },
      },
    },
  }, async (request, reply) => {
    const { id } = request.params as { id: string };
    const match = await matchService.getById(id);
    if (!match) {
      throw new AppError('Match not found', 404, 'NOT_FOUND');
    }
    return createSingleResponse(match);
  });

  // Get matches for a candidate
  fastify.get('/api/v1/candidates/:candidateId/matches', {
    preHandler: [authenticateRequest, requireCandidateAccess('candidateId'), validateParams(z.object({ candidateId: z.string().uuid() })), validateQuery(matchFiltersSchema.omit({ candidateId: true }))],
    schema: {
      tags: ['Matches'],
      summary: 'Get matches for a candidate',
      params: z.object({ candidateId: z.string().uuid() }),
      query: matchFiltersSchema.omit({ candidateId: true }),
      response: {
        200: { type: 'object', properties: { data: z.array(matchSchema), meta: z.object({}), links: z.object({}).optional() } },
        403: { type: 'object', properties: { error: z.object({}) } },
      },
    },
  }, async (request, reply) => {
    const { candidateId } = request.params as { candidateId: string };
    const filters = request.query as z.infer<typeof matchFiltersSchema>;
    const { data, total } = await matchService.getForCandidate(candidateId, filters);
    return createListResponse(data, filters.page, filters.limit, total, `/api/v1/candidates/${candidateId}/matches`, request);
  });
}