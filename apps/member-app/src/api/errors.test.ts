import { AxiosError, AxiosHeaders } from 'axios';
import { t } from '../i18n';
import { apiErrorCode, apiErrorMessage, isFeatureOff, messageForCode } from './errors';

/** An axios error carrying an HTTP response, like the client sees from the backend */
function httpError(status: number, data: unknown) {
  const config = { headers: new AxiosHeaders() };
  return new AxiosError('fail', undefined, config, {}, { status, statusText: '', headers: {}, config, data });
}

describe('apiErrorCode', () => {
  it('reads the backend code', () => {
    expect(apiErrorCode(httpError(400, { code: 'DAILY_LIMIT', message: 'x' }))).toBe('DAILY_LIMIT');
    expect(apiErrorCode(httpError(400, { code: 'OUTSIDE_BOOKING_WINDOW', message: 'x' }))).toBe('OUTSIDE_BOOKING_WINDOW');
    expect(apiErrorCode(httpError(404, { code: 'CLASS_NOT_FOUND' }))).toBe('CLASS_NOT_FOUND');
  });

  it('treats a code-less 404 as the feature guard', () => {
    const err = httpError(404, { statusCode: 404, message: 'Not Found' });
    expect(isFeatureOff(err)).toBe(true);
    expect(apiErrorCode(err)).toBe('FEATURE_OFF');
    expect(isFeatureOff(httpError(404, { code: 'CLASS_NOT_FOUND' }))).toBe(false);
  });

  it('has client-side codes for no response, bare 429 and anything else', () => {
    expect(apiErrorCode(new AxiosError('offline'))).toBe('NETWORK');
    expect(apiErrorCode(httpError(429, {}))).toBe('RATE_LIMITED');
    expect(apiErrorCode(httpError(400, { message: 'Booking not found' }))).toBe('UNKNOWN');
    expect(apiErrorCode(new Error('boom'))).toBe('UNKNOWN');
  });
});

describe('messageForCode', () => {
  it('has member copy for the booking codes', () => {
    expect(messageForCode('DAILY_LIMIT')).toBe(t.errors.dailyLimit);
    expect(messageForCode('OUTSIDE_BOOKING_WINDOW')).toBe(t.errors.outsideWindow);
    expect(messageForCode('BOOKING_FULL')).toBe(t.errors.bookingFull);
    expect(messageForCode('AMBIGUOUS_ACCOUNT')).toBe(t.errors.ambiguousAccount);
    expect(messageForCode('FEATURE_OFF')).toBe(t.errors.featureOff);
  });

  it('falls back to the generic message', () => {
    expect(messageForCode('SOMETHING_NEW')).toBe(t.errors.unknown);
    expect(apiErrorMessage(new Error('boom'))).toBe(t.errors.unknown);
  });
});
