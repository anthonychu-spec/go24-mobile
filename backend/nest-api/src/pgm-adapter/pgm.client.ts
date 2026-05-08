import { HttpException, HttpStatus, Injectable, Logger } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import axios, { AxiosInstance, AxiosRequestConfig } from 'axios';
import axiosRetry from 'axios-retry';
import CircuitBreaker from 'opossum';

/**
 * Low-level PGM HTTP client.
 * - Adds X-Client-Id / X-Client-Secret on every request
 * - 3s timeout, 2x retry (exponential, only 5xx + timeouts)
 * - Circuit breaker: open after 50% failure rate over 30 reqs, retry after 30s
 *
 * Higher-level adapters (PgmAuthAdapter, PgmBookingAdapter, ...) use this
 * via .post(), .get() — and translate domain errors via error-normalize.ts
 */
@Injectable()
export class PgmClient {
  private readonly logger = new Logger(PgmClient.name);
  private readonly axios: AxiosInstance;
  private readonly breaker: CircuitBreaker<[AxiosRequestConfig], unknown>;

  constructor(private readonly cfg: ConfigService) {
    const baseURL = cfg.get<string>('PGM_API_BASE');
    const clientId = cfg.get<string>('PGM_CLIENT_ID');
    const clientSecret = cfg.get<string>('PGM_CLIENT_SECRET');
    const isProd = cfg.get<string>('NODE_ENV') === 'production';

    if (!baseURL) {
      throw new Error('PGM_API_BASE not set');
    }
    if (!clientId || !clientSecret) {
      // Dev: warn so devs can still bring up Swagger. Prod: hard fail.
      if (isProd) throw new Error('PGM_CLIENT_ID / PGM_CLIENT_SECRET not set');
      this.logger.warn('PGM_CLIENT_ID/SECRET not set — PGM calls will 401 (dev only)');
    }

    this.axios = axios.create({
      baseURL,
      timeout: 8000,
      headers: {
        'Content-Type': 'application/json',
        ...(clientId ? { 'X-Client-Id': clientId } : {}),
        ...(clientSecret ? { 'X-Client-Secret': clientSecret } : {}),
      },
    });

    axiosRetry(this.axios, {
      retries: 2,
      retryDelay: axiosRetry.exponentialDelay,
      retryCondition: (err) =>
        axiosRetry.isNetworkOrIdempotentRequestError(err) ||
        (err.response?.status ?? 0) >= 500,
    });

    this.breaker = new CircuitBreaker(
      async (config: AxiosRequestConfig) => this.axios.request(config),
      {
        timeout: 10000,
        errorThresholdPercentage: 50,
        resetTimeout: 30_000,
        rollingCountTimeout: 30_000,
        rollingCountBuckets: 10,
        volumeThreshold: 10,
      },
    );

    this.breaker.on('open', () => this.logger.warn('PGM circuit breaker OPEN'));
    this.breaker.on('halfOpen', () => this.logger.log('PGM circuit breaker HALF-OPEN'));
    this.breaker.on('close', () => this.logger.log('PGM circuit breaker CLOSED'));
  }

  async post<T>(path: string, body: unknown): Promise<T> {
    return this.request<T>({ method: 'POST', url: path, data: body });
  }

  async get<T>(path: string, params?: Record<string, unknown>): Promise<T> {
    return this.request<T>({ method: 'GET', url: path, params });
  }

  private async request<T>(config: AxiosRequestConfig): Promise<T> {
    try {
      const res = (await this.breaker.fire(config)) as { data: T };
      return res.data;
    } catch (err: unknown) {
      // Re-throw — high-level adapter does normalization
      if (err instanceof Error && err.message?.includes('Breaker is open')) {
        throw new HttpException(
          { code: 'UPSTREAM_DOWN', message: 'PGM unavailable (circuit open)' },
          HttpStatus.SERVICE_UNAVAILABLE,
        );
      }
      throw err;
    }
  }
}
