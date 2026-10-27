import { addDays, dayParts, hkDateKey, hkInstant, hkTime, minutesBetween } from './hkTime';

describe('hkTime', () => {
  it('uses the Hong Kong calendar day, not UTC', () => {
    // 06:30 HKT on 27 Oct is still 26 Oct in UTC
    const t = '2026-10-26T22:30:00.000Z';
    expect(hkDateKey(t)).toBe('2026-10-27');
    expect(hkTime(t)).toBe('06:30');
  });

  it('round-trips a club time', () => {
    const iso = hkInstant('2026-10-27', '19:15');
    expect(iso).toBe('2026-10-27T11:15:00.000Z');
    expect(hkDateKey(iso)).toBe('2026-10-27');
    expect(hkTime(iso)).toBe('19:15');
  });

  it('labels days and steps across months', () => {
    expect(dayParts('2026-10-27')).toMatchObject({ wd: 'TUE', day: 27, month: 'OCT', long: 'Tuesday 27 October' });
    expect(addDays('2026-10-31', 1)).toBe('2026-11-01');
    expect(minutesBetween('2026-10-27T11:15:00Z', '2026-10-27T12:45:00Z')).toBe(90);
  });
});
