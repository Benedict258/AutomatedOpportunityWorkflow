import type { FastifyInstance } from 'fastify';
import { z } from 'zod';
import { getOpportunityService } from '../services/opportunity.service';
import { 
  opportunitySchema,
  createOpportunitySchema,
  updateOpportunitySchema,
  opportunityFiltersSchema,
  opportunityVersionSchema,
  opportunityIntelligenceSchema,
} from '../schemas/opportunity';
import { validateBody, validateParams, validateQuery } from '../middleware/validation';
import { authenticateRequest } from '../middleware/auth';
import { createSingleResponse, createListResponse } from '../utils/api-envelope';
import { AppError } from '../middleware/error';

export async function opportunityRoutes(fastify: FastifyInstance): Promise<void> {
  const opportunityService = getOpportunityService();

  // Create opportunity
  fastify.post('/api/v1/opportunities', {
    preHandler: [authenticateRequest, validateBody(createOpportunitySchema)],
    schema: {
      tags: ['Opportunities'],
      summary: 'Create an opportunity',
      body: createOpportunitySchema,
      response: {
        201: { type: 'object', properties: { data: opportunitySchema } },
      },
    },
  }, async (request, reply) => {
    const opportunity = await opportunityService.create(request.body as z.infer<typeof createOpportunitySchema>);
    reply.code(201).send(createSingleResponse(opportunity));
  });

  // List opportunities
  fastify.get('/api/v1/opportunities', {
    preHandler: [authenticateRequest, validateQuery(opportunityFiltersSchema)],
    schema: {
      tags: ['Opportunities'],
      summary: 'List opportunities',
      query: opportunityFiltersSchema,
      response: {
        200: { type: 'object', properties: { data: z.array(opportunitySchema), meta: z.object({}), links: z.object({}).optional() } },
      },
    },
  }, async (request, reply) => {
    const filters = request.query as z.infer<typeof opportunityFiltersSchema>;
    const { data, total } = await opportunityService.list(filters);
    return createListResponse(data, filters.page, filters.limit, total, '/api/v1/opportunities', request);
  });

  // Get opportunity by ID
  fastify.get('/api/v1/opportunities/:id', {
    preHandler: [authenticateRequest, validateParams(z.object({ id: z.string().uuid() }))],
    schema: {
      tags: ['Opportunities'],
      summary: 'Get opportunity by ID',
      params: z.object({ id: z.string().uuid() }),
      response: {
        200: { type: 'object', properties: { data: opportunitySchema } },
        404: { type: 'object', properties: { error: z.object({}) } },
      },
    },
  }, async (request, reply) => {
    const { id } = request.params as { id: string };
    const opportunity = await opportunityService.getById(id);
    if (!opportunity) {
      throw new AppError('Opportunity not found', 404, 'NOT_FOUND');
    }
    return createSingleResponse(opportunity);
  });

  // Update opportunity
  fastify.patch('/api/v1/opportunities/:id', {
    preHandler: [authenticateRequest, validateParams(z.object({ id: z.string().uuid() })), validateBody(updateOpportunitySchema)],
    schema: {
      tags: ['Opportunities'],
      summary: 'Update an opportunity',
      params: z.object({ id: z.string().uuid() }),
      body: updateOpportunitySchema,
      response: {
        200: { type: 'object', properties: { data: opportunitySchema } },
        404: { type: 'object', properties: { error: z.object({}) } },
      },
    },
  }, async (request, reply) => {
    const { id } = request.params as { id: string };
    const opportunity = await opportunityService.update(id, request.body as z.infer<typeof updateOpportunitySchema>);
    if (!opportunity) {
      throw new AppError('Opportunity not found', 404, 'NOT_FOUND');
    }
    return createSingleResponse(opportunity);
  });

  // Delete opportunity
  fastify.delete('/api/v1/opportunities/:id', {
    preHandler: [authenticateRequest, validateParams(z.object({ id: z.string().uuid() }))],
    schema: {
      tags: ['Opportunities'],
      summary: 'Delete an opportunity',
      params: z.object({ id: z.string().uuid() }),
      response: {
        204: { type: 'null' },
        404: { type: 'object', properties: { error: z.object({}) } },
      },
    },
  }, async (request, reply) => {
    const { id } = request.params as { id: string };
    const deleted = await opportunityService.delete(id);
    if (!deleted) {
      throw new AppError('Opportunity not found', 404, 'NOT_FOUND');
    }
    return reply.code(204).send();
  });

  // Get opportunity intelligence
  fastify.get('/api/v1/opportunities/:id/intelligence', {
    preHandler: [authenticateRequest, validateParams(z.object({ id: z.string().uuid() }))],
    schema: {
      tags: ['Opportunities'],
      summary: 'Get opportunity intelligence',
      description: 'Returns classification, requirements, eligibility, match score, and explanation',
      params: z.object({ id: z.string().uuid() }),
      response: {
        200: { type: 'object', properties: { data: opportunityIntelligenceSchema } },
        404: { type: 'object', properties: { error: z.object({}) } },
      },
    },
  }, async (request, reply) => {
    const { id } = request.params as { id: string };
    const intelligence = await opportunityService.getIntelligence(id);
    if (!intelligence) {
      throw new AppError('Opportunity not found', 404, 'NOT_FOUND');
    }
    return createSingleResponse(intelligence);
  });

  // Get candidate matches for opportunity
  fastify.get('/api/v1/opportunities/:id/matches', {
    preHandler: [authenticateRequest, validateParams(z.object({ id: z.string().uuid() }))],
    schema: {
      tags: ['Opportunities'],
      summary: 'Get candidate matches for opportunity',
      params: z.object({ id: z.string().uuid() }),
      response: {
        200: { type: 'object', properties: { data: z.array(z.object({})) } },
        404: { type: 'object', properties: { error: z.object({}) } },
      },
    },
  }, async (request, reply) => {
    const { id } = request.params as { id: string };
    const matches = await opportunityService.getMatches(id);
    return createSingleResponse(matches);
  });

  // Get opportunity version history
  fastify.get('/api/v1/opportunities/:id/versions', {
    preHandler: [authenticateRequest, validateParams(z.object({ id: z.string().uuid() }))],
    schema: {
      tags: ['Opportunities'],
      summary: 'Get opportunity version history',
      params: z.object({ id: z.string().uuid() }),
      response: {
        200: { type: 'object', properties: { data: z.array(opportunityVersionSchema) } },
        404: { type: 'object', properties: { error: z.object({}) } },
      },
    },
  }, async (request, reply) => {
    const { id } = request.params as { id: string };
    const versions = await opportunityService.getVersions(id);
    return createSingleResponse(versions);
  });

  // Trigger reprocessing
  fastify.post('/api/v1/opportunities/:id/reprocess', {
    preHandler: [authenticateRequest, validateParams(z.object({ id: z.string().uuid() }))],
    schema: {
      tags: ['Opportunities'],
      summary: 'Trigger reprocessing for an opportunity',
      params: z.object({ id: z.string().uuid() }),
      response: {
        202: { type: 'object', properties: { data: z.object({ message: z.string() }) } },
        404: { type: 'object', properties: { error: z.object({}) } },
      },
    },
  }, async (request, reply) => {
    const { id } = request.params as { id: string };
    await opportunityService.reprocess(id);
    return createSingleResponse({ message: 'Reprocessing triggered' });
  });

  // Trigger verification
  fastify.post('/api/v1/opportunities/:id/verify', {
    preHandler: [authenticateRequest, validateParams(z.object({ id: z.string().uuid() }))],
    schema: {
      tags: ['Opportunities'],
      summary: 'Trigger verification for an opportunity',
      params: z.object({ id: z.string().uuid() }),
      response: {
        202: { type: 'object', properties: { data: z.object({ message: z.string() }) } },
        404: { type: 'object', properties: { error: z.object({}) } },
      },
    },
  }, async (request, reply) => {
    const { id } = request.params as { id: string };
    await opportunityService.verify(id);
    return createSingleResponse({ message: 'Verification triggered' });
  });

  // Get deadline details
  fastify.get('/api/v1/opportunities/:id/deadline', {
    preHandler: [authenticateRequest, validateParams(z.object({ id: z.string().uuid() }))],
    schema: {
      tags: ['Opportunities'],
      summary: 'Get deadline details for an opportunity',
      params: z.object({ id: z.string().uuid() }),
      response: {
        200: { type: 'object', properties: { data: z.object({}) } },
        404: { type: 'object', properties: { error: z.object({}) } },
      },
    },
  }, async (request, reply) => {
    const { id } = request.params as { id: string };
    const deadline = await opportunityService.getDeadlineDetails(id);
    if (!deadline) {
      throw new AppError('Opportunity not found', 404, 'NOT_FOUND');
    }
    return createSingleResponse(deadline);
  });
}