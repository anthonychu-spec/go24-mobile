import { PassportService, hkMonthStart, hkWeekStart, weeksInARow } from './passport.service';

const HK = (s: string) => new Date(`${s}+08:00`).getTime();
// Wednesday 28 Oct 2026, 10:00 Hong Kong
const NOW = HK('2026-10-28T10:00:00');

describe('Hong Kong calendar helpers', () => {
  it('starts the month at 00:00 HKT on the 1st', () => {
    const m = hkMonthStart(HK('2026-11-01T00:30:00')); // still 31 Oct in UTC
    expect(m.label).toBe('2026-11');
    expect(m.start.toISOString()).toBe('2026-10-31T16:00:00.000Z');
  });

  it('starts the week on Monday 00:00 HKT', () => {
    expect(new Date(hkWeekStart(NOW)).toISOString()).toBe('2026-10-25T16:00:00.000Z'); // Mon 26 Oct HKT
  });
});

describe('weeksInARow', () => {
  it('counts consecutive weeks ending this week', () => {
    const visits = [HK('2026-10-27T07:00:00'), HK('2026-10-20T07:00:00'), HK('2026-10-13T07:00:00')];
    expect(weeksInARow(visits, NOW)).toBe(3);
  });

  it("doesn't break the run while this week has no visit yet", () => {
    const visits = [HK('2026-10-21T07:00:00'), HK('2026-10-14T07:00:00')];
    expect(weeksInARow(visits, NOW)).toBe(2);
  });

  it('stops at the first week without a visit', () => {
    const visits = [HK('2026-10-27T07:00:00'), HK('2026-10-13T07:00:00')];
    expect(weeksInARow(visits, NOW)).toBe(1);
  });
});

describe('PassportService.visits', () => {
  const settings = { get: jest.fn().mockResolvedValue({ visitGoal: 12 }) };
  const brands = { clubIds: jest.fn().mockResolvedValue([45]) };

  it("counts this month's visits at the brand's clubs only, with the goal", async () => {
    const pgm = { get: jest.fn().mockResolvedValue({ value: [
      { enterDate: '2026-10-27T07:00:00+08:00' },
      { enterDate: '2026-10-02T07:00:00+08:00' },
      { enterDate: '2026-09-30T07:00:00+08:00' }, // last month
    ] }) };
    const res = await new PassportService(pgm as any, brands as any, settings as any).visits('u1', 7, 'lab', NOW);
    expect(res).toEqual({ month: '2026-10', visitsThisMonth: 2, weeksInARow: 1, visitGoal: 12 });
    const filter = pgm.get.mock.calls[0][1].$filter as string;
    expect(filter).toContain('memberId eq 7');
    expect(filter).toContain('(clubId eq 45)');
    expect(filter).not.toContain("datetime'");
  });

  it('returns null (not 0) when PGM cannot be read', async () => {
    const pgm = { get: jest.fn().mockRejectedValue(new Error('timeout')) };
    const res = await new PassportService(pgm as any, brands as any, settings as any).visits('u1', 7, 'lab', NOW);
    expect(res.visitsThisMonth).toBeNull();
    expect(res.weeksInARow).toBeNull();
    expect(res.visitGoal).toBe(12);
  });

  it('returns zero without asking PGM for a brand with no clubs', async () => {
    const pgm = { get: jest.fn() };
    const noClubs = { clubIds: jest.fn().mockResolvedValue([]) };
    const res = await new PassportService(pgm as any, noClubs as any, settings as any).visits('u1', 7, 'foundry', NOW);
    expect(res.visitsThisMonth).toBe(0);
    expect(pgm.get).not.toHaveBeenCalled();
  });
});
