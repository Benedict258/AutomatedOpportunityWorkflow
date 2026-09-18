import { RetryPolicy, RetryResult, ReliabilityEvent } from './types';
import { classifyError } from './error-classification';
import { emitEvent } from './observability';

function generateId(): string {
  return Math.random().toString(36).slice(2) + Date.now().toString(36);
}

function sleep(ms: number): Promise<void> {
  return new Promise(resolve => setTimeout(resolve, ms));
}

export class RetryManager {
  private policy: Required<RetryPolicy>;

  constructor(policy: RetryPolicy) {
    this.policy = {
      backoffFactor: 2,
      jitter: true,
      retryableCategories: ['transient', 'rate-limit'],
      ...policy,
    };
  }

  async execute<T>(
    sourceId: string,
    operation: string,
    fn: () => Promise<T>,
    metadata?: Record<string, unknown>
  ): Promise<RetryResult<T>> {
    const start = Date.now();
    const events: ReliabilityEvent[] = [];
    let attempt = 0;
    let lastError: Error | undefined;

    while (attempt < this.policy.maxAttempts) {
      attempt++;
      try {
        const result = await fn();
        const durationMs = Date.now() - start;
        
        if (attempt > 1) {
          emitEvent({
            id: generateId(),
            timestamp: Date.now(),
            sourceId,
            operation,
            category: 'transient',
            message: `Succeeded after ${attempt} attempts`,
            attempt,
            metadata,
          });
        }

        return {
          success: true,
          data: result,
          attempts: attempt,
          durationMs,
          events,
        };
      } catch (err) {
        lastError = err instanceof Error ? err : new Error(String(err));
        const category = classifyError(lastError);
        
        const event: ReliabilityEvent = {
          id: generateId(),
          timestamp: Date.now(),
          sourceId,
          operation,
          category,
          errorCode: (lastError as any).code,
          message: lastError.message,
          attempt,
          metadata,
        };
        events.push(event);
        emitEvent(event);

        const shouldRetry = this.shouldRetry(category, attempt);
        if (!shouldRetry) {
          break;
        }

        if (attempt >= this.policy.maxAttempts) break;

        const delay = this.calculateDelay(attempt);
        await sleep(delay);
      }
    }

    const durationMs = Date.now() - start;
    return {
      success: false,
      attempts: attempt,
      durationMs,
      lastError,
      events,
    };
  }

  private shouldRetry(category: string, attempt: number): boolean {
    if (attempt >= this.policy.maxAttempts) return false;
    if (!this.policy.retryableCategories.includes(category as any)) return false;
    return true;
  }

  private calculateDelay(attempt: number): number {
    const exponential = this.policy.baseDelayMs * Math.pow(this.policy.backoffFactor, attempt - 1);
    const capped = Math.min(exponential, this.policy.maxDelayMs);
    if (!this.policy.jitter) return capped;
    
    const jitter = Math.random() * capped * 0.3;
    return Math.floor(capped + jitter);
  }

  static defaultPolicy(): RetryPolicy {
    return {
      maxAttempts: 3,
      baseDelayMs: 500,
      maxDelayMs: 10000,
      jitter: true,
      backoffFactor: 2,
      retryableCategories: ['transient', 'rate-limit'],
    };
  }
}
