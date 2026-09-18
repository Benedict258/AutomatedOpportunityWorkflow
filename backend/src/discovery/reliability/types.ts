export type ErrorCategory = 'transient' | 'permanent' | 'rate-limit' | 'auth' | 'unknown';

export type CircuitBreakerState = 'CLOSED' | 'OPEN' | 'HALF_OPEN';

export interface ReliabilityEvent {
  id: string;
  timestamp: number;
  sourceId: string;
  operation: string;
  category: ErrorCategory;
  errorCode?: string;
  message: string;
  attempt: number;
  metadata?: Record<string, unknown>;
}

export interface RetryPolicy {
  maxAttempts: number;
  baseDelayMs: number;
  maxDelayMs: number;
  jitter?: boolean;
  backoffFactor?: number;
  retryableCategories?: ErrorCategory[];
}

export interface CircuitBreakerConfig {
  failureThreshold: number;
  successThreshold: number;
  timeoutMs: number;
  windowMs?: number;
}

export interface CircuitBreakerStateSnapshot {
  state: CircuitBreakerState;
  failures: number;
  successes: number;
  lastFailureTime?: number;
  nextAttemptTime?: number;
}

export interface RetryResult<T> {
  success: boolean;
  data?: T;
  attempts: number;
  durationMs: number;
  lastError?: Error;
  events: ReliabilityEvent[];
}

export interface ObservabilityMetrics {
  totalRequests: number;
  failedRequests: number;
  retriedRequests: number;
  circuitBreakerTrips: number;
  avgLatencyMs: number;
  errorsByCategory: Record<ErrorCategory, number>;
}
