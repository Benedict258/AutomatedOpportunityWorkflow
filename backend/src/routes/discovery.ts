import type { FastifyInstance } from 'fastify';
import { z } from 'zod';
import { getDiscoveryService, initializeDiscoveryService } from '../services/discovery.service';
import { 
  createJobOptionsSchema,
  discoveryJobSchema,
  discoveryRunSchema,
  runScheduleRequestSchema,
  runCancelRequestSchema,
  runPollOptionsSchema,
  uuidSchema,
  paginationSchema,
} from '../schemas/discovery';
import { validateBody, validateParams, validateQuery } from '../middleware/validation';
import { authenticateRequest } from '../middleware/auth';
import { createSingleResponse, createListResponse } from '../utils/api-envelope';
import { AppError } from '../middleware/error';
import { logger } from '../utils/logger';
import { zodToJson } from '../utils/schema-converter';

export async function discoveryRoutes(fastify: FastifyInstance): Promise<void> {
  // Initialize discovery service with dependencies
  const discoveryService = initializeDiscoveryService({
    sourceRegistryService: {}, // placeholder
    adapterFactory: {}, // placeholder
  });

  // Create discovery job
  fastify.post('/api/v1/discovery/jobs', {
    preHandler: [authenticateRequest, validateBody(createJobOptionsSchema)],
    schema: {
      tags: ['Discovery'],
      summary: 'Create a discovery job',
      description: 'Creates a new discovery job template',
      body: zodToJson(createJobOptionsSchema),
      response: {
        201: { type: 'object', properties: { data: zodToJson(discoveryJobSchema) } },
      },
    },
  }, async (request, reply) => {
    const job = await discoveryService.createJob(request.body as z.infer<typeof createJobOptionsSchema>);
    reply.code(201).send(createSingleResponse(job));
  });

  // Get job details
  fastify.get('/api/v1/discovery/jobs/:jobId', {
    preHandler: [authenticateRequest, validateParams(z.object({ jobId: uuidSchema }))],
    schema: {
      tags: ['Discovery'],
      summary: 'Get job details',
      params: zodToJson(z.object({ jobId: uuidSchema })),
      response: {
        200: { type: 'object', properties: { data: zodToJson(discoveryJobSchema) } },
        404: { type: 'object', properties: { error: zodToJson(z.object({})) } },
      },
    },
  }, async (request, reply) => {
    const { jobId } = request.params as { jobId: string };
    const job = await discoveryService.getJob(jobId);
    if (!job) {
      throw new AppError('Job not found', 404, 'NOT_FOUND');
    }
    return createSingleResponse(job);
  });

  // Execute job (create run)
  fastify.post('/api/v1/discovery/jobs/:jobId/execute', {
    preHandler: [authenticateRequest, validateParams(z.object({ jobId: uuidSchema }))],
    schema: {
      tags: ['Discovery'],
      summary: 'Execute a discovery job',
      description: 'Creates and starts a discovery run for the job',
      params: zodToJson(z.object({ jobId: uuidSchema })),
      response: {
        201: { type: 'object', properties: { data: zodToJson(discoveryRunSchema) } },
        404: { type: 'object', properties: { error: zodToJson(z.object({})) } },
        409: { type: 'object', properties: { error: zodToJson(z.object({})) } },
      },
    },
  }, async (request, reply) => {
    const { jobId } = request.params as { jobId: string };
    try {
      const run = await discoveryService.executeJob(jobId);
      reply.code(201).send(createSingleResponse(run));
    } catch (error) {
      if (error instanceof Error && error.message.includes('already processing')) {
        throw new AppError(error.message, 409, 'CONFLICT');
      }
      throw error;
    }
  });

  // Schedule a run (via RunCoordinator)
  fastify.post('/api/v1/discovery/runs', {
    preHandler: [authenticateRequest, validateBody(runScheduleRequestSchema)],
    schema: {
      tags: ['Discovery'],
      summary: 'Schedule a discovery run',
      body: zodToJson(runScheduleRequestSchema),
      response: {
        201: { type: 'object', properties: { data: zodToJson(z.object({ runId: uuidSchema })) } },
      },
    },
  }, async (request, reply) => {
    const run = await discoveryService.scheduleRun(request.body as z.infer<typeof runScheduleRequestSchema>);
    reply.code(201).send(createSingleResponse(run));
  });

  // Get run status
  fastify.get('/api/v1/discovery/runs/:runId', {
    preHandler: [authenticateRequest, validateParams(z.object({ runId: uuidSchema }))],
    schema: {
      tags: ['Discovery'],
      summary: 'Get discovery run status',
      params: zodToJson(z.object({ runId: uuidSchema })),
      response: {
        200: { type: 'object', properties: { data: zodToJson(discoveryRunSchema) } },
        404: { type: 'object', properties: { error: zodToJson(z.object({})) } },
      },
    },
  }, async (request, reply) => {
    const { runId } = request.params as { runId: string };
    const run = await discoveryService.getRunStatus(runId);
    if (!run) {
      throw new AppError('Run not found', 404, 'NOT_FOUND');
    }
    return createSingleResponse(run);
  });

  // Get run results (discovered opportunities)
  fastify.get('/api/v1/discovery/runs/:runId/results', {
    preHandler: [authenticateRequest, validateParams(z.object({ runId: uuidSchema }))],
    schema: {
      tags: ['Discovery'],
      summary: 'Get discovery run results',
      params: zodToJson(z.object({ runId: uuidSchema })),
      response: {
        200: { type: 'object', properties: { data: zodToJson(z.object({ run: discoveryRunSchema.nullable(), opportunities: z.array(z.unknown()) })) } },
        404: { type: 'object', properties: { error: zodToJson(z.object({})) } },
      },
    },
  }, async (request, reply) => {
    const { runId } = request.params as { runId: string };
    const { run, opportunities } = await discoveryService.getRunResults(runId);
    if (!run) {
      throw new AppError('Run not found', 404, 'NOT_FOUND');
    }
    return createSingleResponse({ run, opportunities });
  });

  // Cancel run
  fastify.post('/api/v1/discovery/runs/:runId/cancel', {
    preHandler: [authenticateRequest, validateParams(z.object({ runId: uuidSchema })), validateBody(runCancelRequestSchema.omit({ runId: true }))],
    schema: {
      tags: ['Discovery'],
      summary: 'Cancel a discovery run',
      params: zodToJson(z.object({ runId: uuidSchema })),
      body: zodToJson(runCancelRequestSchema.omit({ runId: true })),
      response: {
        200: { type: 'object', properties: { data: zodToJson(discoveryRunSchema) } },
        404: { type: 'object', properties: { error: zodToJson(z.object({})) } },
        409: { type: 'object', properties: { error: zodToJson(z.object({})) } },
      },
    },
  }, async (request, reply) => {
    const { runId } = request.params as { runId: string };
    const { reason } = request.body as { reason?: string };
    try {
      const run = await discoveryService.cancelRun({ runId, reason });
      return createSingleResponse(run);
    } catch (error) {
      if (error instanceof Error && error.message.includes('cannot be cancelled')) {
        throw new AppError(error.message, 409, 'CONFLICT');
      }
      throw error;
    }
  });

  // Pause run
  fastify.post('/api/v1/discovery/runs/:runId/pause', {
    preHandler: [authenticateRequest, validateParams(z.object({ runId: uuidSchema }))],
    schema: {
      tags: ['Discovery'],
      summary: 'Pause a discovery run',
      params: zodToJson(z.object({ runId: uuidSchema })),
      response: {
        200: { type: 'object', properties: { data: zodToJson(discoveryRunSchema) } },
        404: { type: 'object', properties: { error: zodToJson(z.object({})) } },
        409: { type: 'object', properties: { error: zodToJson(z.object({})) } },
      },
    },
  }, async (request, reply) => {
    const { runId } = request.params as { runId: string };
    try {
      const run = await discoveryService.pauseRun(runId);
      return createSingleResponse(run);
    } catch (error) {
      if (error instanceof Error && error.message.includes('Only RUNNING')) {
        throw new AppError(error.message, 409, 'CONFLICT');
      }
      throw error;
    }
  });

  // Resume run
  fastify.post('/api/v1/discovery/runs/:runId/resume', {
    preHandler: [authenticateRequest, validateParams(z.object({ runId: uuidSchema }))],
    schema: {
      tags: ['Discovery'],
      summary: 'Resume a paused discovery run',
      params: zodToJson(z.object({ runId: uuidSchema })),
      response: {
        200: { type: 'object', properties: { data: zodToJson(discoveryRunSchema) } },
        404: { type: 'object', properties: { error: zodToJson(z.object({})) } },
        409: { type: 'object', properties: { error: zodToJson(z.object({})) } },
      },
    },
  }, async (request, reply) => {
    const { runId } = request.params as { runId: string };
    try {
      const run = await discoveryService.resumeRun(runId);
      return createSingleResponse(run);
    } catch (error) {
      if (error instanceof Error && error.message.includes('Only PAUSED')) {
        throw new AppError(error.message, 409, 'CONFLICT');
      }
      throw error;
    }
  });

  // Poll run status
  fastify.get('/api/v1/discovery/runs/:runId/poll', {
    preHandler: [authenticateRequest, validateParams(z.object({ runId: uuidSchema })), validateQuery(runPollOptionsSchema.omit({ runId: true }))],
    schema: {
      tags: ['Discovery'],
      summary: 'Poll discovery run status until completion',
      params: zodToJson(z.object({ runId: uuidSchema })),
      query: zodToJson(runPollOptionsSchema.omit({ runId: true })),
      response: {
        200: { type: 'object', properties: { data: zodToJson(discoveryRunSchema) } },
        404: { type: 'object', properties: { error: zodToJson(z.object({})) } },
        408: { type: 'object', properties: { error: zodToJson(z.object({})) } },
      },
    },
  }, async (request, reply) => {
    const { runId } = request.params as { runId: string };
    const { intervalMs, timeoutMs } = request.query as { intervalMs?: number; timeoutMs?: number };
    try {
      const run = await discoveryService.pollRunStatus({ runId, intervalMs, timeoutMs });
      return createSingleResponse(run);
    } catch (error) {
      if (error instanceof Error && error.message.includes('timeout')) {
        throw new AppError(error.message, 408, 'TIMEOUT');
      }
      throw error;
    }
  });

  // List runs
  const listRunsQuerySchema = paginationSchema.extend({
    status: z.array(z.enum(['PENDING', 'RUNNING', 'SUCCEEDED', 'FAILED', 'CANCELLED', 'PARTIAL'])).optional(),
    jobId: uuidSchema.optional(),
    triggeredBy: z.string().optional(),
    startedAfter: z.string().datetime().optional(),
    startedBefore: z.string().datetime().optional(),
  });

  fastify.get('/api/v1/discovery/runs', {
    preHandler: [authenticateRequest, validateQuery(listRunsQuerySchema)],
    schema: {
      tags: ['Discovery'],
      summary: 'List discovery runs',
      query: zodToJson(listRunsQuerySchema),
      response: {
        200: { type: 'object', properties: { data: zodToJson(z.array(discoveryRunSchema)), meta: zodToJson(z.object({})), links: zodToJson(z.object({}).optional()) } },
      },
    },
  }, async (request, reply) => {
    const filters = request.query as z.infer<typeof listRunsQuerySchema>;
    const { data, total } = await discoveryService.listRuns(filters);
    return createListResponse(data, filters.page, filters.limit, total, '/api/v1/discovery/runs', request);
  });
}