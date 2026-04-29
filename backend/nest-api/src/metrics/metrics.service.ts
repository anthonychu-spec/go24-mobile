
import { Injectable } from '@nestjs/common';
import {
  Registry, Counter, Histogram, collectDefaultMetrics,
} from 'prom-client';

@Injectable()
export class MetricsService {
  readonly registry = new Registry();

  readonly pgmLatency = new Histogram({
    name: 'pgm_request_duration_seconds',
    help: 'PGM API request latency in seconds',
    labelNames: ['endpoint', 'status'],
    buckets: [0.05, 0.1, 0.3, 0.5, 1, 2, 5],
    registers: [this.registry],
  });

  readonly pgmErrors = new Counter({
    name: 'pgm_errors_total',
    help: 'Total PGM API errors',
    labelNames: ['endpoint', 'code'],
    registers: [this.registry],
  });

  readonly authLogins = new Counter({
    name: 'auth_logins_total',
    help: 'Total login attempts',
    labelNames: ['status'],
    registers: [this.registry],
  });

  readonly circuitBreakerState = new Counter({
    name: 'pgm_circuit_breaker_events_total',
    help: 'Circuit breaker state change events',
    labelNames: ['event'],
    registers: [this.registry],
  });

  constructor() {
    collectDefaultMetrics({ register: this.registry });
  }

  metrics() {
    return this.registry.metrics();
  }

  contentType() {
    return this.registry.contentType;
  }
}
