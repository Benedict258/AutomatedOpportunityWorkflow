import type { FastifyInstance } from 'fastify';
import { z } from 'zod';
import { getNewsService } from '../services/news.service';
import { 
  newsItemSchema,
  createNewsItemSchema,
  updateNewsItemSchema,
  newsFiltersSchema,
} from '../schemas/news';
import { validateBody, validateParams, validateQuery } from '../middleware/validation';
import { authenticateRequest } from '../middleware/auth';
import { createSingleResponse, createListResponse } from '../utils/api-envelope';
import { AppError } from '../middleware/error';
import { zodToJson } from '../utils/schema-converter';

export async function newsRoutes(fastify: FastifyInstance): Promise<void> {
  const newsService = getNewsService();

  // Create news item
  fastify.post('/api/v1/news', {
    preHandler: [authenticateRequest, validateBody(createNewsItemSchema)],
    schema: {
      tags: ['News'],
      summary: 'Create a news item',
      body: zodToJson(createNewsItemSchema),
      response: {
        201: { type: 'object', properties: { data: zodToJson(newsItemSchema) } },
      },
    },
  }, async (request, reply) => {
    const news = await newsService.create(request.body as z.infer<typeof createNewsItemSchema>);
    reply.code(201).send(createSingleResponse(news));
  });

  // List news
  fastify.get('/api/v1/news', {
    preHandler: [authenticateRequest, validateQuery(newsFiltersSchema)],
    schema: {
      tags: ['News'],
      summary: 'List news items',
      query: zodToJson(newsFiltersSchema),
      response: {
        200: { type: 'object', properties: { data: zodToJson(z.array(newsItemSchema)), meta: zodToJson(z.object({})), links: zodToJson(z.object({}).optional()) } },
      },
    },
  }, async (request, reply) => {
    const filters = request.query as z.infer<typeof newsFiltersSchema>;
    const { data, total } = await newsService.list(filters);
    return createListResponse(data, filters.page, filters.limit, total, '/api/v1/news', request);
  });

  // Get news by ID
  fastify.get('/api/v1/news/:id', {
    preHandler: [authenticateRequest, validateParams(z.object({ id: z.string().uuid() }))],
    schema: {
      tags: ['News'],
      summary: 'Get news item by ID',
      params: zodToJson(z.object({ id: z.string().uuid() })),
      response: {
        200: { type: 'object', properties: { data: zodToJson(newsItemSchema) } },
        404: { type: 'object', properties: { error: zodToJson(z.object({})) } },
      },
    },
  }, async (request, reply) => {
    const { id } = request.params as { id: string };
    const news = await newsService.getById(id);
    if (!news) {
      throw new AppError('News item not found', 404, 'NOT_FOUND');
    }
    return createSingleResponse(news);
  });

  // Update news item
  fastify.patch('/api/v1/news/:id', {
    preHandler: [authenticateRequest, validateParams(z.object({ id: z.string().uuid() })), validateBody(updateNewsItemSchema)],
    schema: {
      tags: ['News'],
      summary: 'Update a news item',
      params: zodToJson(z.object({ id: z.string().uuid() })),
      body: zodToJson(updateNewsItemSchema),
      response: {
        200: { type: 'object', properties: { data: zodToJson(newsItemSchema) } },
        404: { type: 'object', properties: { error: zodToJson(z.object({})) } },
      },
    },
  }, async (request, reply) => {
    const { id } = request.params as { id: string };
    const news = await newsService.update(id, request.body as z.infer<typeof updateNewsItemSchema>);
    if (!news) {
      throw new AppError('News item not found', 404, 'NOT_FOUND');
    }
    return createSingleResponse(news);
  });

  // Delete news item
  fastify.delete('/api/v1/news/:id', {
    preHandler: [authenticateRequest, validateParams(z.object({ id: z.string().uuid() }))],
    schema: {
      tags: ['News'],
      summary: 'Delete a news item',
      params: zodToJson(z.object({ id: z.string().uuid() })),
      response: {
        204: { type: 'null' },
        404: { type: 'object', properties: { error: zodToJson(z.object({})) } },
      },
    },
  }, async (request, reply) => {
    const { id } = request.params as { id: string };
    const deleted = await newsService.delete(id);
    if (!deleted) {
      throw new AppError('News item not found', 404, 'NOT_FOUND');
    }
    return reply.code(204).send();
  });

  // Get related opportunities for news
  fastify.get('/api/v1/news/:id/related-opportunities', {
    preHandler: [authenticateRequest, validateParams(z.object({ id: z.string().uuid() }))],
    schema: {
      tags: ['News'],
      summary: 'Get related opportunities for a news item',
      params: zodToJson(z.object({ id: z.string().uuid() })),
      response: {
        200: { type: 'object', properties: { data: zodToJson(z.array(z.object({}))) } },
        404: { type: 'object', properties: { error: zodToJson(z.object({})) } },
      },
    },
  }, async (request, reply) => {
    const { id } = request.params as { id: string };
    const opportunities = await newsService.getRelatedOpportunities(id);
    return createSingleResponse(opportunities);
  });
}