import type { FastifyInstance } from 'fastify';
import { z } from 'zod';
import { getApplicationService } from '../services/application.service';
import { 
  applicationSchema,
  createApplicationSchema,
  updateApplicationSchema,
  applicationFiltersSchema,
  reminderSchema,
  sendReminderRequestSchema,
} from '../schemas/application';
import { validateBody, validateParams, validateQuery } from '../middleware/validation';
import { authenticateRequest, requireCandidateAccess } from '../middleware/auth';
import { createSingleResponse, createListResponse } from '../utils/api-envelope';
import { AppError } from '../middleware/error';
import { zodToJson } from '../utils/schema-converter';

export async function applicationRoutes(fastify: FastifyInstance): Promise<void> {
  const applicationService = getApplicationService();

  // Create application reference
  fastify.post('/api/v1/applications', {
    preHandler: [authenticateRequest, validateBody(createApplicationSchema)],
    schema: {
      tags: ['Applications'],
      summary: 'Create an application reference',
      body: zodToJson(createApplicationSchema),
      response: {
        201: { type: 'object', properties: { data: zodToJson(applicationSchema) } },
      },
    },
  }, async (request, reply) => {
    const candidateId = request.candidateId!;
    const application = await applicationService.create(request.body as z.infer<typeof createApplicationSchema>, candidateId);
    reply.code(201).send(createSingleResponse(application));
  });

  // List applications (candidate-scoped)
  fastify.get('/api/v1/applications', {
    preHandler: [authenticateRequest, validateQuery(applicationFiltersSchema)],
    schema: {
      tags: ['Applications'],
      summary: 'List applications for authenticated candidate',
      query: zodToJson(applicationFiltersSchema),
      response: {
        200: { type: 'object', properties: { data: zodToJson(z.array(applicationSchema)), meta: zodToJson(z.object({})), links: zodToJson(z.object({}).optional()) } },
      },
    },
  }, async (request, reply) => {
    const candidateId = request.candidateId!;
    const filters = request.query as z.infer<typeof applicationFiltersSchema>;
    const { data, total } = await applicationService.list(filters, candidateId);
    return createListResponse(data, filters.page, filters.limit, total, '/api/v1/applications', request);
  });

  // Get application by ID
  fastify.get('/api/v1/applications/:id', {
    preHandler: [authenticateRequest, validateParams(z.object({ id: z.string().uuid() }))],
    schema: {
      tags: ['Applications'],
      summary: 'Get application by ID',
      params: zodToJson(z.object({ id: z.string().uuid() })),
      response: {
        200: { type: 'object', properties: { data: zodToJson(applicationSchema) } },
        404: { type: 'object', properties: { error: zodToJson(z.object({})) } },
      },
    },
  }, async (request, reply) => {
    const { id } = request.params as { id: string };
    const application = await applicationService.getById(id);
    if (!application) {
      throw new AppError('Application not found', 404, 'NOT_FOUND');
    }
    // Verify ownership
    if (application.userId !== request.candidateId) {
      throw new AppError('Access denied', 403, 'FORBIDDEN');
    }
    return createSingleResponse(application);
  });

  // Update application
  fastify.patch('/api/v1/applications/:id', {
    preHandler: [authenticateRequest, validateParams(z.object({ id: z.string().uuid() })), validateBody(updateApplicationSchema)],
    schema: {
      tags: ['Applications'],
      summary: 'Update an application',
      params: zodToJson(z.object({ id: z.string().uuid() })),
      body: zodToJson(updateApplicationSchema),
      response: {
        200: { type: 'object', properties: { data: zodToJson(applicationSchema) } },
        404: { type: 'object', properties: { error: zodToJson(z.object({})) } },
        403: { type: 'object', properties: { error: zodToJson(z.object({})) } },
      },
    },
  }, async (request, reply) => {
    const { id } = request.params as { id: string };
    const application = await applicationService.getById(id);
    if (!application) {
      throw new AppError('Application not found', 404, 'NOT_FOUND');
    }
    if (application.userId !== request.candidateId) {
      throw new AppError('Access denied', 403, 'FORBIDDEN');
    }
    const updated = await applicationService.update(id, request.body as z.infer<typeof updateApplicationSchema>);
    return createSingleResponse(updated);
  });

  // Send reminder
  fastify.post('/api/v1/applications/:id/reminders', {
    preHandler: [authenticateRequest, validateParams(z.object({ id: z.string().uuid() })), validateBody(sendReminderRequestSchema)],
    schema: {
      tags: ['Applications'],
      summary: 'Send a reminder for an application',
      params: zodToJson(z.object({ id: z.string().uuid() })),
      body: zodToJson(sendReminderRequestSchema),
      response: {
        201: { type: 'object', properties: { data: zodToJson(reminderSchema) } },
        404: { type: 'object', properties: { error: zodToJson(z.object({})) } },
        403: { type: 'object', properties: { error: zodToJson(z.object({})) } },
      },
    },
  }, async (request, reply) => {
    const { id } = request.params as { id: string };
    const application = await applicationService.getById(id);
    if (!application) {
      throw new AppError('Application not found', 404, 'NOT_FOUND');
    }
    if (application.userId !== request.candidateId) {
      throw new AppError('Access denied', 403, 'FORBIDDEN');
    }
    const reminder = await applicationService.sendReminder(id, request.body as z.infer<typeof sendReminderRequestSchema>);
    reply.code(201).send(createSingleResponse(reminder));
  });

  // Get reminder history
  fastify.get('/api/v1/applications/:id/reminders', {
    preHandler: [authenticateRequest, validateParams(z.object({ id: z.string().uuid() }))],
    schema: {
      tags: ['Applications'],
      summary: 'Get reminder history for an application',
      params: zodToJson(z.object({ id: z.string().uuid() })),
      response: {
        200: { type: 'object', properties: { data: zodToJson(z.array(reminderSchema)) } },
        404: { type: 'object', properties: { error: zodToJson(z.object({})) } },
        403: { type: 'object', properties: { error: zodToJson(z.object({})) } },
      },
    },
  }, async (request, reply) => {
    const { id } = request.params as { id: string };
    const application = await applicationService.getById(id);
    if (!application) {
      throw new AppError('Application not found', 404, 'NOT_FOUND');
    }
    if (application.userId !== request.candidateId) {
      throw new AppError('Access denied', 403, 'FORBIDDEN');
    }
    const reminders = await applicationService.getReminderHistory(id);
    return createSingleResponse(reminders);
  });

  // Get applications for a candidate (admin or self)
  fastify.get('/api/v1/candidates/:candidateId/applications', {
    preHandler: [authenticateRequest, requireCandidateAccess('candidateId'), validateParams(z.object({ candidateId: z.string().uuid() })), validateQuery(applicationFiltersSchema.omit({ userId: true }))],
    schema: {
      tags: ['Applications'],
      summary: 'Get applications for a specific candidate',
      params: zodToJson(z.object({ candidateId: z.string().uuid() })),
      query: zodToJson(applicationFiltersSchema.omit({ userId: true })),
      response: {
        200: { type: 'object', properties: { data: zodToJson(z.array(applicationSchema)), meta: zodToJson(z.object({})), links: zodToJson(z.object({}).optional()) } },
        403: { type: 'object', properties: { error: zodToJson(z.object({})) } },
      },
    },
  }, async (request, reply) => {
    const { candidateId } = request.params as { candidateId: string };
    const filters = request.query as z.infer<typeof applicationFiltersSchema>;
    const { data, total } = await applicationService.getForCandidate(candidateId, filters);
    return createListResponse(data, filters.page, filters.limit, total, `/api/v1/candidates/${candidateId}/applications`, request);
  });
}