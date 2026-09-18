export interface RateLimitConfig {
  requestsPerMinute?: number;
  requestsPerHour?: number;
  requestsPerDay?: number;
  burst?: number;
}

export class TokenBucketRateLimiter {
  private tokens: number;
  private lastRefill: number;
  private readonly capacity: number;
  private readonly refillRatePerMs: number;

  constructor(config: RateLimitConfig) {
    const rpm = config.requestsPerMinute ?? 60;
    const capacity = config.burst ?? rpm;
    this.capacity = capacity;
    this.tokens = capacity;
    this.refillRatePerMs = rpm / 60000;
    this.lastRefill = Date.now();
  }

  private refill(): void {
    const now = Date.now();
    const elapsed = now - this.lastRefill;
    const tokensToAdd = elapsed * this.refillRatePerMs;
    this.tokens = Math.min(this.capacity, this.tokens + tokensToAdd);
    this.lastRefill = now;
  }

  async acquire(): Promise<void> {
    this.refill();
    if (this.tokens >= 1) {
      this.tokens -= 1;
      return;
    }
    const waitMs = Math.ceil((1 - this.tokens) / this.refillRatePerMs);
    await new Promise(resolve => setTimeout(resolve, waitMs));
    this.refill();
    if (this.tokens >= 1) {
      this.tokens -= 1;
      return;
    }
    // Fallback
    await new Promise(resolve => setTimeout(resolve, 100));
    this.acquire();
  }

  getState() {
    this.refill();
    return {
      tokens: this.tokens,
      capacity: this.capacity,
    };
  }
}

export class RateLimiterRegistry {
  private limiters = new Map<string, TokenBucketRateLimiter>();

  getLimiter(sourceId: string, config?: RateLimitConfig): TokenBucketRateLimiter {
    if (!this.limiters.has(sourceId)) {
      const limiter = new TokenBucketRateLimiter(config ?? {});
      this.limiters.set(sourceId, limiter);
    }
    return this.limiters.get(sourceId)!;
  }

  async wait(sourceId: string, config?: RateLimitConfig): Promise<void> {
    const limiter = this.getLimiter(sourceId, config);
    await limiter.acquire();
  }

  clear(sourceId?: string): void {
    if (sourceId) {
      this.limiters.delete(sourceId);
    } else {
      this.limiters.clear();
    }
  }
}
