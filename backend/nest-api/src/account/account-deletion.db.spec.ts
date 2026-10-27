import { DataSource, EntityTarget, ObjectLiteral } from 'typeorm';
import { dataSourceOptions } from '../database/data-source';
import { AccountDeletionService, DELETED_ACTOR } from './account-deletion.service';
import { SessionValidator } from '../auth/session-validator';
import { Session } from '../auth/entities/session.entity';
import { User } from '../auth/entities/user.entity';
import { Booking } from '../bookings/entities/booking.entity';
import { BookingEvent } from '../bookings/entities/booking-event.entity';
import { IdempotencyKey } from '../bookings/entities/idempotency-key.entity';
import { OutboxEvent } from '../bookings/entities/outbox-event.entity';
import { ACCOUNT_DELETED } from '../bookings/booking.service';
import { UserFavourite } from '../favourites/entities/user-favourite.entity';
import { MembershipRequest } from '../membership-requests/entities/membership-request.entity';
import { MemberMilestone } from '../milestones/entities/member-milestone.entity';
import { DeviceToken } from '../notifications/entities/device-token.entity';
import { Notification } from '../notifications/entities/notification.entity';
import { Charge } from '../payments/entities/charge.entity';
import { PaymentMethod } from '../payments/entities/payment-method.entity';
import { PtLog } from '../pt/entities/pt-log.entity';
import { Referral } from '../referral/entities/referral.entity';
import { UserSettings } from '../settings/entities/user-settings.entity';
import { FaceEnrollment } from '../signup/entities/face-enrollment.entity';

/**
 * Account deletion against a real, migrated Postgres. Uses its own database next
 * to TEST_DATABASE_URL (name + "_deletion") because schema.spec drops the public
 * schema of that one and the two files may run at the same time. Skipped when
 * TEST_DATABASE_URL is unset.
 */
const url = process.env.TEST_DATABASE_URL;
const describeDb = url ? describe : describe.skip;

describeDb('account deletion (database)', () => {
  let admin: DataSource;
  let ds: DataSource;
  let svc: AccountDeletionService;
  let validator: SessionValidator;
  const forgotten: string[] = [];

  const repo = <T extends ObjectLiteral>(e: EntityTarget<T>) => ds.getRepository(e);
  const count = (e: EntityTarget<ObjectLiteral>, where: object) => repo(e).count({ where });

  let member: User;
  let other: User;
  let sessionId: string;

  beforeAll(async () => {
    const base = new URL(url!);
    if (!base.pathname.slice(1).includes('test')) throw new Error('TEST_DATABASE_URL must point at a test database');
    const name = `${base.pathname.slice(1)}_deletion`;
    admin = new DataSource({ type: 'postgres', url: url! });
    await admin.initialize();
    await admin.query(`DROP DATABASE IF EXISTS "${name}"`);
    await admin.query(`CREATE DATABASE "${name}"`);

    const own = new URL(url!);
    own.pathname = `/${name}`;
    ds = new DataSource(dataSourceOptions(own.toString()));
    await ds.initialize();
    await ds.runMigrations({ transaction: 'each' });

    validator = new SessionValidator(repo(Session), repo(User));
    const forget = validator.forget.bind(validator);
    validator.forget = (id: string) => { forgotten.push(id); forget(id); };
    svc = new AccountDeletionService(ds, validator);
  }, 120_000);

  afterAll(async () => {
    await ds?.destroy();
    await admin?.destroy();
  });

  /** Two members with one row in every table; only the first gets deleted. */
  async function seed(): Promise<void> {
    const later = new Date(Date.now() + 86_400_000);
    [member, other] = await repo(User).save([
      { pgmMemberId: 7, email: 'm@x.co', phone: '91234567', memberCode: 'M7', role: 'member', status: 'active' },
      { pgmMemberId: 8, email: 'o@x.co', phone: '98765432', memberCode: 'M8', role: 'member', status: 'active' },
    ]);
    for (const u of [member, other]) {
      const s = await repo(Session).save({
        userId: u.id, refreshTokenHash: `h-${u.id}`, deviceFingerprint: 'fp', devicePlatform: 'ios', brand: 'lab', expiresAt: later,
      });
      if (u === member) sessionId = s.id;
      await repo(DeviceToken).save({ userId: u.id, token: `ExpoToken[${u.id}]`, platform: 'ios', brand: 'lab' });
      await repo(Notification).save({ userId: u.id, type: 'booking_confirmed', title: 't', body: 'b' });
      await repo(UserSettings).save({ userId: u.id, reminderMinutes: 30 });
      await repo(UserFavourite).save({ userId: u.id, classTemplateId: 'c1', className: 'HIIT' });
      await repo(IdempotencyKey).save({ userId: u.id, key: 'k1', endpoint: 'POST /bookings', expiresAt: later });
      await repo(MemberMilestone).save({ userId: u.id, milestone: 10, unlockedAt: new Date() });
      await repo(MembershipRequest).save({ userId: u.id, startDate: '2026-11-01', endDate: '2026-11-30', reason: 'travel' });
      await repo(PaymentMethod).save({ userId: u.id, shopperReference: `shopper-${u.id}`, cardSummary: '1234' });
      await repo(FaceEnrollment).save({ userId: u.id, photoB64: 'aGVsbG8=' });
      await repo(PtLog).save({ userId: u.id, signedAt: new Date(), signature: 'data:image/png;base64,xx', notes: 'knee' });
      await repo(Charge).save({ userId: u.id, amountHkd: 100, description: 'day pass', type: 'daypass', pgmId: u.pgmMemberId });
      const [done, pending] = await repo(Booking).save([
        { userId: u.id, pgmMemberId: u.pgmMemberId, classId: 1, externalId: `pgm-${u.id}`, status: 'confirmed', idempotencyKey: `a-${u.id}`, className: 'HIIT' },
        { userId: u.id, pgmMemberId: u.pgmMemberId, classId: 2, status: 'pending_verify', errorCode: 'TEMP_FAIL', idempotencyKey: `b-${u.id}` },
      ]);
      await repo(BookingEvent).save([
        { bookingId: done.id, toState: 'cancelled', reason: 'user cancel', actor: u.id },
        { bookingId: pending.id, toState: 'pending', reason: 'init', actor: 'system' },
      ]);
      await repo(OutboxEvent).save({ topic: 'booking.cancelled', payload: { bookingId: done.id, classId: 1, userId: u.id } });
    }
    await repo(Referral).save([
      { referrerId: member.id, referrerCode: 'MEM7', referredUserId: other.id },
      { referrerId: other.id, referrerCode: 'OTH8', referredUserId: member.id },
    ]);
  }

  it('deletes, de-identifies and tombstones exactly one member', async () => {
    await seed();
    expect(await validator.isValid(sessionId, member.id)).toBe(true); // cached as live

    await expect(svc.deleteUser(member.id)).resolves.toEqual({ deleted: true });

    for (const e of [Session, DeviceToken, Notification, UserSettings, UserFavourite, IdempotencyKey,
      MemberMilestone, MembershipRequest, PaymentMethod, FaceEnrollment]) {
      expect(await count(e, { userId: member.id })).toBe(0);
      expect(await count(e, { userId: other.id })).toBe(1);
    }

    const u = await repo(User).findOneByOrFail({ id: member.id });
    expect(u).toMatchObject({ status: 'deleted', email: null, phone: null, pgmMemberId: null, memberCode: null });
    expect(u.deletedAt).toBeInstanceOf(Date);

    const bookings = await repo(Booking).find({ where: { userId: member.id }, order: { classId: 'ASC' } });
    expect(bookings).toHaveLength(2);
    expect(bookings.every(b => b.pgmMemberId === null)).toBe(true);
    expect(bookings[0]).toMatchObject({ status: 'confirmed', className: 'HIIT' });
    expect(bookings[1]).toMatchObject({ status: 'pending_verify', errorCode: ACCOUNT_DELETED });

    expect(await count(BookingEvent, { actor: member.id })).toBe(0);
    expect(await count(BookingEvent, { actor: DELETED_ACTOR })).toBe(1);
    expect(await count(BookingEvent, { actor: other.id })).toBe(1);

    const outbox = await repo(OutboxEvent).find();
    const mine = outbox.find(o => o.payload.bookingId === bookings[0].id)!;
    expect(mine.payload).toEqual({ bookingId: bookings[0].id, classId: 1 });
    expect(outbox.find(o => o.payload.userId === other.id)).toBeDefined();

    expect(await repo(PtLog).findOneByOrFail({ userId: member.id })).toMatchObject({ signature: '', notes: null });
    expect(await repo(PtLog).findOneByOrFail({ userId: other.id })).toMatchObject({ notes: 'knee' });

    expect(await count(Referral, { referrerId: member.id })).toBe(0);
    expect(await repo(Referral).findOneByOrFail({ referrerId: other.id })).toMatchObject({ referredUserId: null });

    // Payment records stay
    expect(await count(Charge, { userId: member.id })).toBe(1);
    // The other member is untouched
    expect(await repo(User).findOneByOrFail({ id: other.id })).toMatchObject({ status: 'active', email: 'o@x.co', pgmMemberId: 8 });
  }, 60_000);

  it('ends the member’s access token at once', async () => {
    expect(forgotten).toContain(sessionId);
    expect(await validator.isValid(sessionId, member.id)).toBe(false);
  });

  it('lets the same PGM member sign up again as a fresh user', async () => {
    const again = await repo(User).save({ pgmMemberId: 7, role: 'member', status: 'active' });
    expect(again.id).not.toBe(member.id);
    await expect(svc.deleteByPgmMemberId(7)).resolves.toEqual({ deleted: true });
  });

  it('is a no-op the second time', async () => {
    await expect(svc.deleteUser(member.id)).resolves.toEqual({ deleted: false });
  });
});
