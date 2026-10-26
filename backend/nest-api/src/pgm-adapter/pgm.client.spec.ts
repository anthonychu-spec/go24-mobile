import { AxiosError } from 'axios';
import { shouldRetryPgmRequest } from './pgm.client';

function err(method: string, status?: number, code?: string): AxiosError {
  const e = new AxiosError('boom', code, { method, headers: {} as any });
  if (status) e.response = { status, data: {}, statusText: '', headers: {}, config: e.config! };
  return e;
}

describe('shouldRetryPgmRequest', () => {
  it('retries a GET on 5xx and on network errors', () => {
    expect(shouldRetryPgmRequest(err('get', 503))).toBe(true);
    expect(shouldRetryPgmRequest(err('get', undefined, 'ECONNRESET'))).toBe(true);
  });

  it('never retries a POST — booking or cancelling twice is worse than an unknown result', () => {
    expect(shouldRetryPgmRequest(err('post', 503))).toBe(false);
    expect(shouldRetryPgmRequest(err('post', 500))).toBe(false);
    expect(shouldRetryPgmRequest(err('post', undefined, 'ECONNRESET'))).toBe(false);
  });

  it('does not retry a GET on 4xx', () => {
    expect(shouldRetryPgmRequest(err('get', 400))).toBe(false);
  });
});
