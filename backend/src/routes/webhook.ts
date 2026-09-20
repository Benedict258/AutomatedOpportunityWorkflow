import type { FastifyInstance, FastifyRequest, FastifyReply } from 'fastify';
import { z } from 'zod';
import { 
  discoveryCompleteWebhookSchema,
  intelligenceCompleteWebhookSchema,
  highPriorityAlertWebhookSchema,
  applicationTrackingWebhookSchema,
  discoveryManualTriggerSchema,
  reprocessingManualTriggerSchema,
  verificationCompleteWebhookSchema,
  reprocessingCompleteWebhookSchema,
} from '../schemas/webhook';
import { validateBody } from '../middleware/validation';
import { zodToJson } from '../utils/schema-converter';
import { verifyWebhookSignature } from '../middleware/auth';
import { createSingleResponse } from '../utils/api-envelope';
import { AppError } from '../middleware/error';
import { logger } from '../utils/logger';
import { createIntelligencePipeline } from '../intelligence/pipeline/real-pipeline';
import { UnifiedModelService } from 'shared/models/unified-service';

// Idempotency key storage for webhooks
const processedWebhooks = new Map<string, number>();

// Initialize model service once (wrapped to avoid top-level await in CJS)
let pipeline: ReturnType<typeof createIntelligencePipeline>;
(async () => {
  const modelService = new UnifiedModelService();
  await modelService.initialize();
  pipeline = createIntelligencePipeline(modelService);
})();

function checkWebhookIdempotency(idempotencyKey: string): boolean {
  const now = Date.now();
  const lastProcessed = processedWebhooks.get(idempotencyKey);
  if (lastProcessed && now - lastProcessed < 86400000) { // 24 hours
    return false; // Already processed
  }
  processedWebhooks.set(idempotencyKey, now);
  return true;
}

export async function webhookRoutes(fastify: FastifyInstance): Promise<void> {
  // Shared handlers
  const handleDiscoveryComplete = async (request: FastifyRequest, reply: FastifyReply) => {
    const body = request.body as z.infer<typeof discoveryCompleteWebhookSchema>;
    const idempotencyKey = request.headers['idempotency-key'] as string || `news-opportunity-${body.runId}`;
    
    if (!checkWebhookIdempotency(idempotencyKey)) {
      throw new AppError('Duplicate webhook - already processed', 409, 'DUPLICATE');
    }

    logger.info({ runId: body.runId, status: body.status }, 'Received news-opportunity webhook');

    // Build minimal input for pipeline from available schema fields
    const firstOpp = body.opportunities?.[0];
    const rawDocument = {
      externalId: firstOpp?.externalId || body.runId,
      rawData: '',
      contentType: 'text/plain',
      documentId: firstOpp?.id || body.runId,
    };
    const candidateProfile = { skills: [], experience: [] };
    const opportunityId = firstOpp?.id;
    const candidateId = undefined;

    try {
      await pipeline.run({ rawDocument, candidateProfile, opportunityId, candidateId });
      logger.info({ opportunityId, candidateId }, 'Intelligence pipeline completed');
    } catch (err) {
      logger.error({ err, opportunityId }, 'Pipeline failed');
    }

    return createSingleResponse({ message: 'Webhook accepted for processing' });
  };

  const handleIntelligenceComplete = async (request: FastifyRequest, reply: FastifyReply) => {
    const body = request.body as any;
    logger.info({ opportunityId: body.opportunityId, runId: body.runId, status: body.status }, 'Received intelligence complete webhook');
    return createSingleResponse({ message: 'Intelligence webhook accepted for processing' });
  };

  const handleHighPriorityAlert = async (request: FastifyRequest, reply: FastifyReply) => {
    const body = request.body as z.infer<typeof highPriorityAlertWebhookSchema>;
    logger.info({ alertType: body.alertType, severity: body.severity }, 'Received high-priority alert webhook');
    return createSingleResponse({ message: 'Alert accepted for notification delivery' });
  };

  const handleVerificationComplete = async (request: FastifyRequest, reply: FastifyReply) => {
    const body = request.body as z.infer<typeof verificationCompleteWebhookSchema>;
    logger.info({ runId: body.runId, status: body.status }, 'Received verification complete webhook');
    return createSingleResponse({ message: 'Verification result accepted' });
  };

  const handleReprocessingComplete = async (request: FastifyRequest, reply: FastifyReply) => {
    const body = request.body as z.infer<typeof reprocessingCompleteWebhookSchema>;
    logger.info({ runId: body.runId, status: body.status }, 'Received reprocessing complete webhook');
    return createSingleResponse({ message: 'Reprocessing result accepted' });
  };

  // News -> Opportunity webhook (n8n callback)
  fastify.post('/api/v1/webhooks/news-opportunity', {
    preHandler: [verifyWebhookSignature, validateBody(discoveryCompleteWebhookSchema)],
    schema: {
      tags: ['Webhooks'],
      summary: 'News to Opportunity webhook',
      description: 'n8n callback when news item generates opportunity candidates',
      body: zodToJson(discoveryCompleteWebhookSchema),
      response: {
        202: { type: 'object', properties: { data: zodToJson(z.object({ message: z.string() })) } },
        401: { type: 'object', properties: { error: zodToJson(z.object({})) } },
        409: { type: 'object', properties: { error: zodToJson(z.object({})) } },
      },
    },
  }, handleDiscoveryComplete);

  // Alias for tests / legacy discovery-complete path
  fastify.post('/api/v1/webhooks/discovery-complete', {
    preHandler: [verifyWebhookSignature, validateBody(discoveryCompleteWebhookSchema)],
    schema: {
      tags: ['Webhooks'],
      summary: 'Discovery complete webhook (alias)',
      description: 'n8n callback when discovery run completes',
      body: zodToJson(discoveryCompleteWebhookSchema),
      response: {
        202: { type: 'object', properties: { data: zodToJson(z.object({ message: z.string() })) } },
        401: { type: 'object', properties: { error: zodToJson(z.object({})) } },
        409: { type: 'object', properties: { error: zodToJson(z.object({})) } },
      },
    },
  }, handleDiscoveryComplete);

  // Intelligence complete webhook
  fastify.post('/api/v1/webhooks/intelligence-complete', {
    preHandler: [verifyWebhookSignature, validateBody(intelligenceCompleteWebhookSchema)],
    schema: {
      tags: ['Webhooks'],
      summary: 'Intelligence complete webhook',
      description: 'n8n callback when intelligence pipeline completes',
      body: zodToJson(intelligenceCompleteWebhookSchema),
      response: {
        202: { type: 'object', properties: { data: zodToJson(z.object({ message: z.string() })) } },
        401: { type: 'object', properties: { error: zodToJson(z.object({})) } },
      },
    },
  }, handleIntelligenceComplete);

  // High priority alert webhook
  fastify.post('/api/v1/webhooks/high-priority', {
    preHandler: [verifyWebhookSignature, validateBody(highPriorityAlertWebhookSchema)],
    schema: {
      tags: ['Webhooks'],
      summary: 'High priority alert webhook',
      description: 'n8n callback for high-priority alerts (deadline soon, high match, etc.)',
      body: zodToJson(highPriorityAlertWebhookSchema),
      response: {
        202: { type: 'object', properties: { data: zodToJson(z.object({ message: z.string() })) } },
        401: { type: 'object', properties: { error: zodToJson(z.object({})) } },
      },
    },
  }, handleHighPriorityAlert);

  // Alias for tests
  fastify.post('/api/v1/webhooks/high-priority-alert', {
    preHandler: [verifyWebhookSignature, validateBody(highPriorityAlertWebhookSchema)],
    schema: {
      tags: ['Webhooks'],
      summary: 'High priority alert webhook (alias)',
      description: 'n8n callback for high-priority alerts',
      body: zodToJson(highPriorityAlertWebhookSchema),
      response: {
        202: { type: 'object', properties: { data: zodToJson(z.object({ message: z.string() })) } },
        401: { type: 'object', properties: { error: zodToJson(z.object({})) } },
      },
    },
  }, handleHighPriorityAlert);

  // Application tracking webhook
  fastify.post('/api/v1/webhooks/application-tracking', {
    preHandler: [verifyWebhookSignature, validateBody(applicationTrackingWebhookSchema)],
    schema: {
      tags: ['Webhooks'],
      summary: 'Application tracking webhook',
      description: 'n8n callback for application status changes',
      body: zodToJson(applicationTrackingWebhookSchema),
      response: {
        202: { type: 'object', properties: { data: zodToJson(z.object({ message: z.string() })) } },
        401: { type: 'object', properties: { error: zodToJson(z.object({})) } },
      },
    },
  }, async (request, reply) => {
    const body = request.body as z.infer<typeof applicationTrackingWebhookSchema>;
    logger.info({ applicationId: body.applicationId, event: body.event }, 'Received application tracking webhook');
    
    // TODO: Update application status, send reminders/notifications
    return createSingleResponse({ message: 'Application event accepted for processing' });
  });

  // Manual discovery trigger webhook
  fastify.post('/api/v1/webhooks/discovery-manual', {
    preHandler: [verifyWebhookSignature, validateBody(discoveryManualTriggerSchema)],
    schema: {
      tags: ['Webhooks'],
      summary: 'Manual discovery trigger webhook',
      description: 'n8n callback to manually trigger discovery',
      body: zodToJson(discoveryManualTriggerSchema),
      response: {
        202: { type: 'object', properties: { data: zodToJson(z.object({ message: z.string(), jobId: z.string().optional() })) } },
        401: { type: 'object', properties: { error: zodToJson(z.object({})) } },
      },
    },
  }, async (request, reply) => {
    const body = request.body as z.infer<typeof discoveryManualTriggerSchema>;
    logger.info({ triggeredBy: body.triggeredBy }, 'Received manual discovery trigger');
    
    // TODO: Trigger discovery job via DiscoveryService
    return createSingleResponse({ message: 'Discovery trigger accepted', jobId: 'pending' });
  });

  // Manual reprocessing trigger webhook
  fastify.post('/api/v1/webhooks/reprocessing-manual', {
    preHandler: [verifyWebhookSignature, validateBody(reprocessingManualTriggerSchema)],
    schema: {
      tags: ['Webhooks'],
      summary: 'Manual reprocessing trigger webhook',
      description: 'n8n callback to manually trigger reprocessing',
      body: zodToJson(reprocessingManualTriggerSchema),
      response: {
        202: { type: 'object', properties: { data: zodToJson(z.object({ message: z.string(), runId: z.string().optional() })) } },
        401: { type: 'object', properties: { error: zodToJson(z.object({})) } },
      },
    },
  }, async (request, reply) => {
    const body = request.body as z.infer<typeof reprocessingManualTriggerSchema>;
    logger.info({ opportunityCount: body.opportunityIds.length, force: body.forceReprocess }, 'Received manual reprocessing trigger');
    
    // TODO: Trigger reprocessing via ReprocessingService
    return createSingleResponse({ message: 'Reprocessing trigger accepted', runId: 'pending' });
  });

  // Verification complete webhook (n8n callback)
  fastify.post('/api/v1/webhooks/verification/complete', {
    preHandler: [verifyWebhookSignature, validateBody(verificationCompleteWebhookSchema)],
    schema: {
      tags: ['Webhooks'],
      summary: 'Verification complete webhook',
      description: 'n8n callback when verification run completes',
      body: zodToJson(verificationCompleteWebhookSchema),
      response: {
        202: { type: 'object', properties: { data: zodToJson(z.object({ message: z.string() })) } },
        401: { type: 'object', properties: { error: zodToJson(z.object({})) } },
      },
    },
  }, handleVerificationComplete);

  // Alias for tests
  fastify.post('/api/v1/webhooks/verification-complete', {
    preHandler: [verifyWebhookSignature, validateBody(verificationCompleteWebhookSchema)],
    schema: {
      tags: ['Webhooks'],
      summary: 'Verification complete webhook (alias)',
      description: 'n8n callback when verification run completes',
      body: zodToJson(verificationCompleteWebhookSchema),
      response: {
        202: { type: 'object', properties: { data: zodToJson(z.object({ message: z.string() })) } },
        401: { type: 'object', properties: { error: zodToJson(z.object({})) } },
      },
    },
  }, handleVerificationComplete);

  // Reprocessing complete webhook (n8n callback)
  fastify.post('/api/v1/webhooks/reprocessing/complete', {
    preHandler: [verifyWebhookSignature, validateBody(reprocessingCompleteWebhookSchema)],
    schema: {
      tags: ['Webhooks'],
      summary: 'Reprocessing complete webhook',
      description: 'n8n callback when reprocessing run completes',
      body: zodToJson(reprocessingCompleteWebhookSchema),
      response: {
        202: { type: 'object', properties: { data: zodToJson(z.object({ message: z.string() })) } },
        401: { type: 'object', properties: { error: zodToJson(z.object({})) } },
      },
    },
  }, handleReprocessingComplete);

  // Alias for tests
  fastify.post('/api/v1/webhooks/reprocessing-complete', {
    preHandler: [verifyWebhookSignature, validateBody(reprocessingCompleteWebhookSchema)],
    schema: {
      tags: ['Webhooks'],
      summary: 'Reprocessing complete webhook (alias)',
      description: 'n8n callback when reprocessing run completes',
      body: zodToJson(reprocessingCompleteWebhookSchema),
      response: {
        202: { type: 'object', properties: { data: zodToJson(z.object({ message: z.string() })) } },
        401: { type: 'object', properties: { error: zodToJson(z.object({})) } },
      },
    },
  }, handleReprocessingComplete);
}