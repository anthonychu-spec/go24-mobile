import { In } from 'typeorm';
import { AccountDeletionService, DELETED_ACTOR } from './account-deletion.service';
import { ACCOUNT_DELETED, CANCEL_UNKNOWN } from '../bookings/booking.service';

type Call = { op: 'delete' | 'update' | 'query'; table: string; where?: unknown; patch?: unknown; params?: unknown };

let calls: Call[];
let user: Record<string, unknown> | null;
const forget = jest.fn();
const findByPgm = jest.fn();

const em = {
  findOne: jest.fn(async () => user),
  find: jest.fn(async () => [{ id: 's1' }, { id: 's2' }]),
  delete: jest.fn(async (e: { name: string }, where: unknown) => { calls.push({ op: 'delete', table: e.name, where }); }),
  update: jest.fn(async (e: { name: string }, where: unknown, patch: unknown) => {
    calls.push({ op: 'update', table: e.name, where, patch });
  }),
  query: jest.fn(async (sql: string, params: unknown) => { calls.push({ op: 'query', table: sql, params }); }),
};
const dataSource = {
  transaction: jest.fn(async (fn: (m: typeof em) => unknown) => fn(em)),
  getRepository: () => ({ findOne: findByPgm }),
};

const svc = new AccountDeletionService(dataSource as any, { forget } as any);

beforeEach(() => {
  jest.clearAllMocks();
  calls = [];
  user = { id: 'u1', status: 'active', pgmMemberId: 7 };
});

const deleted = (table: string) => calls.filter(c => c.op === 'delete' && c.table === table);
const updated = (table: string) => calls.filter(c => c.op === 'update' && c.table === table);

describe('AccountDeletionService.deleteUser', () => {
  it.each([
    'Session', 'DeviceToken', 'Notification', 'UserSettings', 'UserFavourite', 'IdempotencyKey',
    'MemberMilestone', 'MembershipRequest', 'PaymentMethod', 'FaceEnrollment',
  ])('deletes the member’s %s rows', async table => {
    await svc.deleteUser('u1');
    expect(deleted(table)).toEqual([{ op: 'delete', table, where: { userId: 'u1' } }]);
  });

  it('deletes referrals the member made and unlinks referrals that name them', async () => {
    await svc.deleteUser('u1');
    expect(deleted('Referral')).toEqual([expect.objectContaining({ where: { referrerId: 'u1' } })]);
    expect(updated('Referral')).toEqual([
      expect.objectContaining({ where: { referredUserId: 'u1' }, patch: { referredUserId: null } }),
    ]);
  });

  it('keeps PT logs but clears the signature and notes', async () => {
    await svc.deleteUser('u1');
    expect(updated('PtLog')).toEqual([
      expect.objectContaining({ where: { userId: 'u1' }, patch: { signature: '', notes: null } }),
    ]);
  });

  it('keeps bookings but drops the PGM member id', async () => {
    await svc.deleteUser('u1');
    expect(updated('Booking')).toContainEqual(
      expect.objectContaining({ where: { userId: 'u1' }, patch: { pgmMemberId: null } }),
    );
  });

  it('marks unsettled bookings ACCOUNT_DELETED before the PGM id goes, so reconcile leaves them', async () => {
    await svc.deleteUser('u1');
    const bookings = updated('Booking');
    expect(bookings[0]).toMatchObject({
      where: { userId: 'u1', status: In(['pending', 'pending_verify']) }, patch: { errorCode: ACCOUNT_DELETED },
    });
    expect(bookings[1]).toMatchObject({ where: { userId: 'u1', errorCode: CANCEL_UNKNOWN }, patch: { errorCode: ACCOUNT_DELETED } });
    expect(bookings[2].patch).toEqual({ pgmMemberId: null });
  });

  it('replaces the member as actor in booking_events', async () => {
    await svc.deleteUser('u1');
    expect(updated('BookingEvent')).toEqual([
      expect.objectContaining({ where: { actor: 'u1' }, patch: { actor: DELETED_ACTOR } }),
    ]);
  });

  it('strips personal keys from outbox payloads of the member’s bookings', async () => {
    await svc.deleteUser('u1');
    const q = calls.find(c => c.op === 'query')!;
    expect(q.table).toMatch(/UPDATE outbox_events SET payload = payload - \$2::text\[\]/);
    expect(q.params).toEqual(['u1', expect.arrayContaining(['userId', 'pgmMemberId', 'email', 'phone'])]);
  });

  it('keeps the users row as a tombstone with every identifier cleared', async () => {
    await svc.deleteUser('u1');
    const [u] = updated('User');
    expect(u.where).toEqual({ id: 'u1' });
    expect(u.patch).toMatchObject({
      status: 'deleted', email: null, phone: null, pgmMemberId: null, memberCode: null, trainerCode: null,
      deletedAt: expect.any(Date),
    });
    expect(deleted('User')).toEqual([]);
  });

  it('never touches payment records (charges)', async () => {
    await svc.deleteUser('u1');
    expect(calls.filter(c => c.table === 'Charge')).toEqual([]);
  });

  it('forgets every session after the transaction, so access tokens stop at once', async () => {
    await expect(svc.deleteUser('u1')).resolves.toEqual({ deleted: true });
    expect(forget.mock.calls).toEqual([['s1'], ['s2']]);
  });

  it('locks the user row for the transaction', async () => {
    await svc.deleteUser('u1');
    expect(em.findOne).toHaveBeenCalledWith(expect.anything(), expect.objectContaining({ lock: { mode: 'pessimistic_write' } }));
  });

  it('does nothing for an unknown or already deleted user', async () => {
    user = null;
    await expect(svc.deleteUser('u1')).resolves.toEqual({ deleted: false });
    user = { id: 'u1', status: 'deleted' };
    await expect(svc.deleteUser('u1')).resolves.toEqual({ deleted: false });
    expect(calls).toEqual([]);
    expect(forget).not.toHaveBeenCalled();
  });
});

describe('AccountDeletionService.deleteByPgmMemberId', () => {
  it('deletes the local user of that PGM member', async () => {
    findByPgm.mockResolvedValueOnce({ id: 'u1' });
    await expect(svc.deleteByPgmMemberId(7)).resolves.toEqual({ deleted: true });
    expect(findByPgm).toHaveBeenCalledWith({ where: { pgmMemberId: 7 } });
  });

  it('reports nothing deleted when the member never used an app', async () => {
    findByPgm.mockResolvedValueOnce(null);
    await expect(svc.deleteByPgmMemberId(7)).resolves.toEqual({ deleted: false });
    expect(dataSource.transaction).not.toHaveBeenCalled();
  });
});
