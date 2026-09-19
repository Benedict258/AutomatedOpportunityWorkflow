import type { FastifyRequest, FastifyReply, FastifyInstance } from 'fastify';
import { createRemoteJWKSet, jwtVerify, type JWTPayload } from 'jose';
import { config } from '../config/index.js';
import { logger } from '../utils/logger.js';
import { verifyHmac } from './webhook-hmac.js';

const jwtConfig = config.jwt;
const apiKeyConfig = config.apiKey;

interface AuthPayload extends JWTPayload {
  sub: string;
  candidateId?: string;
  scopes?: string[];
  type?: 'access' | 'api-key';
}

declare module 'fastify' {
  interface FastifyRequest {
    auth?: AuthPayload;
    apiKey?: string;
    candidateId?: string;
  }
}

let jwks: ReturnType<typeof createRemoteJWKSet> | null = null;

async function getJwks() {
  if (!jwks) {
    // In production, this would be a real JWKS endpoint
    // For now, we'll use HS256 with the secret
    // This is a placeholder - real implementation would fetch from auth server
  }
  return jwks;
}

export async function authenticateRequest(
  request: FastifyRequest,
  reply: FastifyReply
): Promise<void> {
  const authHeader = request.headers.authorization;
  const apiKeyHeader = request.headers[apiKeyConfig.header.toLowerCase()];

  // Try JWT Bearer token first
  if (authHeader?.startsWith('Bearer ')) {
    const token = authHeader.slice(7);
    try {
      const payload = await verifyJwt(token);
      request.auth = payload;
      request.candidateId = payload.candidateId || payload.sub;
      request.log.info({ candidateId: request.candidateId }, 'JWT authentication successful');
      return;
    } catch (error) {
      request.log.warn({ err: error }, 'JWT verification failed');
      // Don't throw here, fall through to API key
    }
  }

  // Try API Key
  if (apiKeyHeader && typeof apiKeyHeader === 'string') {
    const apiKey = apiKeyHeader;
    if (apiKey.startsWith(apiKeyConfig.prefix)) {
      // Validate API key against database/store
      const candidateId = await validateApiKey(apiKey);
      if (candidateId) {
        request.apiKey = apiKey;
        request.candidateId = candidateId;
        request.auth = {
          sub: `api-key-${candidateId}`,
          candidateId,
          scopes: ['api'],
          type: 'api-key',
        };
        request.log.info({ candidateId }, 'API key authentication successful');
        return;
      }
    }
    request.log.warn('Invalid API key format');
  }

  // No valid authentication
  reply.code(401).send({
    error: {
      code: 'UNAUTHORIZED',
      message: 'Authentication required. Provide Bearer token or API key.',
      requestId: request.requestId,
    },
  });
  throw new Error('Unauthorized'); // This will be caught by error handler
}

export async function optionalAuthentication(
  request: FastifyRequest,
  reply: FastifyReply
): Promise<void> {
  try {
    await authenticateRequest(request, reply);
  } catch {
    // Ignore - optional auth
  }
}

async function verifyJwt(token: string): Promise<AuthPayload> {
  // For HS256, we use the secret directly
  // In production with RS256, use jwks
  const secret = new TextEncoder().encode(jwtConfig.secret);
  
  const { payload } = await jwtVerify(token, secret, {
    issuer: jwtConfig.issuer,
    audience: jwtConfig.audience,
  });

  return payload as AuthPayload;
}

async function validateApiKey(apiKey: string): Promise<string | null> {
  // TODO: Implement actual API key validation against database
  // For now, return a mock candidate ID for development
  if (process.env.NODE_ENV === 'development') {
    return 'dev-candidate-001';
  }
  
  // In production:
  // const pool = getPool();
  // const result = await pool.query(
  //   'SELECT candidate_id FROM api_keys WHERE key_hash = $1 AND revoked_at IS NULL',
  //   [hashApiKey(apiKey)]
  // );
  // return result.rows[0]?.candidate_id || null;
  
  return null;
}

export function requireScopes(...requiredScopes: string[]) {
  return async (request: FastifyRequest, reply: FastifyReply): Promise<void> => {
    if (!request.auth) {
      reply.code(401).send({
        error: {
          code: 'UNAUTHORIZED',
          message: 'Authentication required',
          requestId: request.requestId,
        },
      });
      throw new Error('Unauthorized');
    }

    const userScopes = request.auth.scopes || [];
    const hasScope = requiredScopes.some((scope) => userScopes.includes(scope));

    if (!hasScope) {
      reply.code(403).send({
        error: {
          code: 'FORBIDDEN',
          message: `Required scope(s): ${requiredScopes.join(', ')}`,
          requestId: request.requestId,
        },
      });
      throw new Error('Forbidden');
    }
  };
}

export function requireCandidateAccess(paramName: string = 'candidateId') {
  return async (request: FastifyRequest, reply: FastifyReply): Promise<void> => {
    if (!request.candidateId) {
      reply.code(401).send({
        error: {
          code: 'UNAUTHORIZED',
          message: 'Candidate context required',
          requestId: request.requestId,
        },
      });
      throw new Error('Unauthorized');
    }

    // If the route has a candidateId param, verify it matches the authenticated candidate
    const paramCandidateId = (request.params as Record<string, string>)[paramName];
    if (paramCandidateId && paramCandidateId !== request.candidateId) {
      // Allow admin/scoped access to bypass this check
      const isAdmin = request.auth?.scopes?.includes('admin') || false;
      if (!isAdmin) {
        reply.code(403).send({
          error: {
            code: 'FORBIDDEN',
            message: 'Access denied to this candidate\'s resources',
            requestId: request.requestId,
          },
        });
        throw new Error('Forbidden');
      }
    }
  };
}

export async function verifyWebhookSignature(
  request: FastifyRequest,
  reply: FastifyReply
): Promise<void> {
  const signature = request.headers[config.webhook.hmacHeader.toLowerCase()];
  const payload = JSON.stringify(request.body);

  if (!signature || typeof signature !== 'string') {
    reply.code(401).send({
      error: {
        code: 'INVALID_SIGNATURE',
        message: 'Missing webhook signature',
        requestId: request.requestId,
      },
    });
    throw new Error('Invalid signature');
  }

  const isValid = await verifyHmac(payload, signature, config.webhook.hmacSecret);
  
  if (!isValid) {
    request.log.warn({ signature }, 'Webhook signature verification failed');
    reply.code(401).send({
      error: {
        code: 'INVALID_SIGNATURE',
        message: 'Invalid webhook signature',
        requestId: request.requestId,
      },
    });
    throw new Error('Invalid signature');
  }

  request.log.info('Webhook signature verified');
}