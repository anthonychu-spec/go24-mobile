import { deadTokens } from './notifications.service';

describe('deadTokens', () => {
  it('picks tokens whose ticket says DeviceNotRegistered, matching tickets by position', () => {
    const tokens = ['t1', 't2', 't3'];
    const tickets = [
      { status: 'ok' as const },
      { status: 'error' as const, details: { error: 'DeviceNotRegistered' } },
      { status: 'error' as const, details: { error: 'MessageRateExceeded' } },
    ];
    expect(deadTokens(tokens, tickets)).toEqual(['t2']);
  });

  it('removes nothing when Expo gave no tickets', () => {
    expect(deadTokens(['t1'], undefined)).toEqual([]);
  });
});
