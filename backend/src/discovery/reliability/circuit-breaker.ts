import { CircuitBreakerConfig, CircuitBreakerState, CircuitBreakerStateSnapshot } from './types';
import { emitEvent } from './observability';

export class CircuitBreaker {
  private state: CircuitBreakerState = 'CLOSED';
  private failures = 0;
  private successes = 0;
  private lastFailureTime?: number;
  private nextAttemptTime?: number;
  private failureWindow: number[] = [];

  constructor(
    private sourceId: string,
    private config: Required<CircuitBreakerConfig>
  ) {}

  async execute<T>(operation: string, fn: () => Promise<T>): Promise<T> {
    this.pruneFailures();

    if (this.state === 'OPEN') {
      if (Date.now() < (this.nextAttemptTime || 0)) {
        const err = new Error(`Circuit breaker OPEN for source ${this.sourceId}`);
        (err as any).code = 'CIRCUIT_OPEN';
        throw err;
      }
      this.transitionToHalfOpen();
    }

    try {
      const result = await fn();
      this.onSuccess();
      return result;
    } catch (err) {
      this.onFailure();
      throw err;
    }
  }

  private onSuccess(): void {
    this.failures = 0;
    this.successes++;

    if (this.state === 'HALF_OPEN') {
      if (this.successes >= this.config.successThreshold) {
        this.transitionToClosed();
      }
    }
  }

  private onFailure(): void {
    this.failures++;
    this.successes = 0;
    this.lastFailureTime = Date.now();
    this.failureWindow.push(this.lastFailureTime);

    emitEvent({
      id: Math.random().toString(36).slice(2),
      timestamp: Date.now(),
      sourceId: this.sourceId,
      operation: 'circuit-breaker',
      category: 'transient',
      message: `Failure recorded. Failures=${this.failures}`,
      attempt: this.failures,
    });

    this.pruneFailures();

    if (this.state === 'HALF_OPEN' || this.failures >= this.config.failureThreshold) {
      this.transitionToOpen();
    }
  }

  private pruneFailures(): void {
    const windowMs = this.config.windowMs || 60000;
    const cutoff = Date.now() - windowMs;
    this.failureWindow = this.failureWindow.filter(t => t > cutoff);
    this.failures = this.failureWindow.length;
  }

  private transitionToOpen(): void {
    if (this.state === 'OPEN') return;
    this.state = 'OPEN';
    this.nextAttemptTime = Date.now() + this.config.timeoutMs;

    emitEvent({
      id: Math.random().toString(36).slice(2),
      timestamp: Date.now(),
      sourceId: this.sourceId,
      operation: 'circuit-breaker',
      category: 'transient',
      message: `Circuit breaker OPENED`,
      attempt: this.failures,
    });
  }

  private transitionToHalfOpen(): void {
    this.state = 'HALF_OPEN';
    this.successes = 0;

    emitEvent({
      id: Math.random().toString(36).slice(2),
      timestamp: Date.now(),
      sourceId: this.sourceId,
      operation: 'circuit-breaker',
      category: 'transient',
      message: `Circuit breaker HALF_OPEN`,
      attempt: 0,
    });
  }

  private transitionToClosed(): void {
    this.state = 'CLOSED';
    this.failures = 0;
    this.successes = 0;
    this.nextAttemptTime = undefined;

    emitEvent({
      id: Math.random().toString(36).slice(2),
      timestamp: Date.now(),
      sourceId: this.sourceId,
      operation: 'circuit-breaker',
      category: 'transient',
      message: `Circuit breaker CLOSED`,
      attempt: 0,
    });
  }

  getState(): CircuitBreakerStateSnapshot {
    return {
      state: this.state,
      failures: this.failures,
      successes: this.successes,
      lastFailureTime: this.lastFailureTime,
      nextAttemptTime: this.nextAttemptTime,
    };
  }

  static defaultConfig(): CircuitBreakerConfig {
    return {
      failureThreshold: 5,
      successThreshold: 2,
      timeoutMs: 30000,
      windowMs: 60000,
    };
  }
}

export class CircuitBreakerRegistry {
  private breakers = new Map<string, CircuitBreaker>();

  get(sourceId: string, config?: CircuitBreakerConfig): CircuitBreaker {
    if (!this.breakers.has(sourceId)) {
      this.breakers.set(sourceId, new CircuitBreaker(sourceId, {
        ...CircuitBreaker.defaultConfig(),
        ...config,
      } as Required<CircuitBreakerConfig>));
    }
    return this.breakers.get(sourceId)!;
  }

  getState(sourceId: string) {
    const breaker = this.breakers.get(sourceId);
    return breaker?.getState();
  }

  allStates() {
    const states: Record<string, CircuitBreakerStateSnapshot> = {};
    for (const [id, breaker] of this.breakers.entries()) {
      states[id] = breaker.getState();
    }
    return states;
  }
}
