import { ErrorCategory } from './types';

export function classifyError(err: unknown): ErrorCategory {
  if (!err) return 'unknown';

  const message = err instanceof Error ? err.message.toLowerCase() : String(err).toLowerCase();
  const code = (err as any)?.code?.toString();
  const status = (err as any)?.status || (err as any)?.response?.status;

  // Auth errors
  if (
    code === 'UNAUTHORIZED' ||
    code === 'FORBIDDEN' ||
    status === 401 ||
    status === 403 ||
    message.includes('unauthorized') ||
    message.includes('forbidden') ||
    message.includes('invalid token') ||
    message.includes('authentication')
  ) {
    return 'auth';
  }

  // Rate limit errors
  if (
    code === 'RATE_LIMIT' ||
    code === 'TOO_MANY_REQUESTS' ||
    status === 429 ||
    message.includes('rate limit') ||
    message.includes('too many requests') ||
    message.includes('quota exceeded')
  ) {
    return 'rate-limit';
  }

  // Permanent errors
  if (
    status === 400 ||
    status === 404 ||
    status === 410 ||
    code === 'NOT_FOUND' ||
    code === 'BAD_REQUEST' ||
    message.includes('not found') ||
    message.includes('bad request') ||
    message.includes('invalid') && !message.includes('temporarily')
  ) {
    // 400/404 are generally permanent for discovery
    return 'permanent';
  }

  // Transient errors
  if (
    status === 408 ||
    status === 502 ||
    status === 503 ||
    status === 504 ||
    code === 'ETIMEDOUT' ||
    code === 'ECONNRESET' ||
    code === 'ENOTFOUND' ||
    code === 'ECONNREFUSED' ||
    message.includes('timeout') ||
    message.includes('econnreset') ||
    message.includes('network') ||
    message.includes('temporary') ||
    message.includes('service unavailable')
  ) {
    return 'transient';
  }

  // Circuit breaker
  if (code === 'CIRCUIT_OPEN') {
    return 'transient';
  }

  return 'unknown';
}

export function isRetryable(category: ErrorCategory): boolean {
  return category === 'transient' || category === 'rate-limit';
}

export function shouldAlert(category: ErrorCategory): boolean {
  return category === 'auth' || category === 'permanent';
}
