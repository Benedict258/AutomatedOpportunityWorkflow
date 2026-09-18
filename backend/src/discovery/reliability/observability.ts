import { ReliabilityEvent, ObservabilityMetrics } from './types';

type LogLevel = 'info' | 'warn' | 'error';

interface MetricEntry {
  name: string;
  value: number;
  tags?: Record<string, string>;
  timestamp: number;
}

class InMemoryStore {
  events: ReliabilityEvent[] = [];
  metrics: MetricEntry[] = [];
  traces: Array<{
    traceId: string;
    spanId: string;
    parentSpanId?: string;
    operation: string;
    startTime: number;
    endTime?: number;
    sourceId: string;
    status: 'ok' | 'error';
    error?: string;
  }> = [];
}

const store = new InMemoryStore();

let metricsAggregator: ObservabilityMetrics = {
  totalRequests: 0,
  failedRequests: 0,
  retriedRequests: 0,
  circuitBreakerTrips: 0,
  avgLatencyMs: 0,
  errorsByCategory: {
    transient: 0,
    permanent: 0,
    'rate-limit': 0,
    auth: 0,
    unknown: 0,
  },
};

function log(level: LogLevel, message: string, meta?: Record<string, unknown>) {
  const entry = {
    timestamp: new Date().toISOString(),
    level,
    message,
    meta,
  };
  // No external deps: write to console with structured format
  console[level === 'error' ? 'error' : level === 'warn' ? 'warn' : 'log'](
    JSON.stringify(entry)
  );
}

export function emitEvent(event: ReliabilityEvent): void {
  store.events.push(event);
  log('info', `Reliability event: ${event.category}`, {
    sourceId: event.sourceId,
    operation: event.operation,
    attempt: event.attempt,
    message: event.message,
  });

  metricsAggregator.errorsByCategory[event.category] =
    (metricsAggregator.errorsByCategory[event.category] || 0) + 1;

  // Keep only last 10k events
  if (store.events.length > 10000) {
    store.events.splice(0, store.events.length - 10000);
  }
}

export function recordMetric(name: string, value: number, tags?: Record<string, string>): void {
  store.metrics.push({ name, value, tags, timestamp: Date.now() });
  if (store.metrics.length > 10000) {
    store.metrics.splice(0, store.metrics.length - 10000);
  }
}

export function startTrace(traceId: string, spanId: string, operation: string, sourceId: string, parentSpanId?: string) {
  store.traces.push({
    traceId,
    spanId,
    parentSpanId,
    operation,
    startTime: Date.now(),
    sourceId,
    status: 'ok',
  });
}

export function endTrace(traceId: string, spanId: string, status: 'ok' | 'error' = 'ok', error?: string) {
  const span = store.traces.find(t => t.traceId === traceId && t.spanId === spanId);
  if (span) {
    span.endTime = Date.now();
    span.status = status;
    span.error = error;
  }
}

export function incrementCounter(name: string, delta = 1) {
  recordMetric(name, delta);
  if (name === 'requests.total') metricsAggregator.totalRequests += delta;
  if (name === 'requests.failed') metricsAggregator.failedRequests += delta;
  if (name === 'requests.retried') metricsAggregator.retriedRequests += delta;
  if (name === 'circuit.breaker.trips') metricsAggregator.circuitBreakerTrips += delta;
}

export function observeLatency(durationMs: number) {
  recordMetric('request.latency_ms', durationMs);
  const total = metricsAggregator.totalRequests || 1;
  metricsAggregator.avgLatencyMs = Math.round(
    (metricsAggregator.avgLatencyMs * (total - 1) + durationMs) / total
  );
}

export function getMetrics(): ObservabilityMetrics {
  return { ...metricsAggregator };
}

export function getRecentEvents(limit = 100): ReliabilityEvent[] {
  return store.events.slice(-limit);
}

export function getEventsBySource(sourceId: string, limit = 100): ReliabilityEvent[] {
  return store.events.filter(e => e.sourceId === sourceId).slice(-limit);
}

export function getTraces(traceId?: string) {
  if (traceId) {
    return store.traces.filter(t => t.traceId === traceId);
  }
  return store.traces.slice(-100);
}

export function healthCheck() {
  return {
    eventsStored: store.events.length,
    metricsStored: store.metrics.length,
    tracesStored: store.traces.length,
    metrics: getMetrics(),
    timestamp: Date.now(),
  };
}

export function logError(error: Error, context?: Record<string, unknown>) {
  log('error', error.message, { ...context, stack: error.stack });
}

export function logWarn(message: string, meta?: Record<string, unknown>) {
  log('warn', message, meta);
}

export function logInfo(message: string, meta?: Record<string, unknown>) {
  log('info', message, meta);
}
