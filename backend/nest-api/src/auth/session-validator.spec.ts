import { SessionValidator } from './session-validator';

const sessions = { findOne: jest.fn() };
const users = { findOne: jest.fn() };

const future = new Date(Date.now() + 3600_000);
const live = { id: 's1', userId: 'u1', revoked: false, expiresAt: future };

let validator: SessionValidator;
beforeEach(() => {
  jest.clearAllMocks();
  validator = new SessionValidator(sessions as any, users as any);
});

describe('SessionValidator', () => {
  it('accepts a live session of an active user', async () => {
    sessions.findOne.mockResolvedValueOnce(live);
    users.findOne.mockResolvedValueOnce({ id: 'u1', status: 'active' });
    await expect(validator.isValid('s1', 'u1')).resolves.toBe(true);
  });

  it('rejects a revoked session (logout, refresh rotation, account deletion)', async () => {
    sessions.findOne.mockResolvedValueOnce({ ...live, revoked: true });
    await expect(validator.isValid('s1', 'u1')).resolves.toBe(false);
  });

  it("rejects a session that belongs to another user", async () => {
    sessions.findOne.mockResolvedValueOnce({ ...live, userId: 'u2' });
    await expect(validator.isValid('s1', 'u1')).resolves.toBe(false);
  });

  it('rejects when the user is no longer active', async () => {
    sessions.findOne.mockResolvedValueOnce(live);
    users.findOne.mockResolvedValueOnce({ id: 'u1', status: 'inactive' });
    await expect(validator.isValid('s1', 'u1')).resolves.toBe(false);
  });

  it('rejects once the account is deleted (sessions gone, user marked deleted)', async () => {
    sessions.findOne.mockResolvedValueOnce(null);
    await expect(validator.isValid('s1', 'u1')).resolves.toBe(false);
    sessions.findOne.mockResolvedValueOnce({ ...live, id: 's2' });
    users.findOne.mockResolvedValueOnce({ id: 'u1', status: 'deleted' });
    await expect(validator.isValid('s2', 'u1')).resolves.toBe(false);
  });

  it('caches the answer, and forget() drops it', async () => {
    sessions.findOne.mockResolvedValue(live);
    users.findOne.mockResolvedValue({ id: 'u1', status: 'active' });
    await validator.isValid('s1', 'u1');
    await validator.isValid('s1', 'u1');
    expect(sessions.findOne).toHaveBeenCalledTimes(1);

    validator.forget('s1');
    await validator.isValid('s1', 'u1');
    expect(sessions.findOne).toHaveBeenCalledTimes(2);
  });
});
