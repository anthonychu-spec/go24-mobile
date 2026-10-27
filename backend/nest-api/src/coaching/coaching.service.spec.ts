import { HttpException, NotFoundException } from '@nestjs/common';
import { CoachingService, DAILY_ENQUIRY_LIMIT } from './coaching.service';

const repo = {
  count: jest.fn(),
  create: jest.fn((e: object) => ({ ...e })),
  save: jest.fn(async (e: object) => ({ id: 'enq-1', createdAt: new Date('2026-10-27T02:00:00Z'), ...e })),
  update: jest.fn(),
  find: jest.fn(),
};
const brands = { ownsClub: jest.fn(async (_b: string, clubId: number) => clubId === 45) };

function service(env: Record<string, string> = {}) {
  const cfg = { get: (k: string) => env[k] };
  return new CoachingService(repo as any, brands as any, cfg as any);
}

const INPUT = { userId: 'u1', pgmMemberId: 7, brand: 'lab' as const, clubId: 45, goal: 'Strength', preferredTimes: 'Weekday mornings' };

const fetchMock = jest.fn();
beforeEach(() => {
  jest.clearAllMocks();
  repo.count.mockResolvedValue(0);
  global.fetch = fetchMock as any;
});

describe('CoachingService.create', () => {
  it('stores the enquiry and says honestly that nobody has been contacted', async () => {
    const res = await service().create(INPUT);
    expect(repo.save).toHaveBeenCalledWith(expect.objectContaining({ userId: 'u1', brand: 'lab', clubId: 45, status: 'received' }));
    expect(res).toMatchObject({ id: 'enq-1', status: 'received' });
    expect(res.message).toMatch(/No coach has contacted you yet/);
  });

  it("refuses a club outside the member's brand", async () => {
    await expect(service().create({ ...INPUT, clubId: 5 })).rejects.toBeInstanceOf(NotFoundException);
    expect(repo.save).not.toHaveBeenCalled();
  });

  it(`allows ${DAILY_ENQUIRY_LIMIT} enquiries per 24 hours, then 429`, async () => {
    repo.count.mockResolvedValueOnce(DAILY_ENQUIRY_LIMIT);
    await expect(service().create(INPUT)).rejects.toBeInstanceOf(HttpException);
    expect(repo.save).not.toHaveBeenCalled();
  });

  it('does not notify anyone by default (decision B4 pending)', async () => {
    await service({ COACHING_NOTIFY_WEBHOOK_URL: 'https://n8n.example/webhook/x' }).create(INPUT);
    expect(fetchMock).not.toHaveBeenCalled();
    expect(repo.update).not.toHaveBeenCalled();
  });

  it('notifies the webhook and records it when switched on', async () => {
    fetchMock.mockResolvedValueOnce({ ok: true, status: 200 });
    await service({ COACHING_NOTIFY_ENABLED: 'true', COACHING_NOTIFY_WEBHOOK_URL: 'https://n8n.example/webhook/x' }).create(INPUT);
    expect(fetchMock).toHaveBeenCalledWith('https://n8n.example/webhook/x', expect.objectContaining({ method: 'POST' }));
    const body = JSON.parse(fetchMock.mock.calls[0][1].body);
    expect(body).toMatchObject({ enquiryId: 'enq-1', pgmMemberId: 7, clubId: 45 });
    expect(repo.update).toHaveBeenCalledWith({ id: 'enq-1' }, { notifiedAt: expect.any(Date) });
  });

  it('keeps the enquiry when the notify call fails', async () => {
    fetchMock.mockResolvedValueOnce({ ok: false, status: 500 });
    const res = await service({ COACHING_NOTIFY_ENABLED: 'true', COACHING_NOTIFY_WEBHOOK_URL: 'https://n8n.example/webhook/x' }).create(INPUT);
    expect(res.id).toBe('enq-1');
    expect(repo.update).not.toHaveBeenCalled();
  });
});
