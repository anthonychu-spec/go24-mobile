import { ReconcileJob } from './reconcile.job';
import { CANCEL_UNKNOWN, WAITLIST_DECLINED } from '../booking.service';
import { TempFailError } from '../errors/index';
import type { Booking } from '../entities/booking.entity';

const bookingRepo = {
  findPendingVerify: jest.fn(),
  findStalePending: jest.fn(),
  findByErrorCode: jest.fn(),
  transition: jest.fn(),
  flagError: jest.fn(),
};
const idempotencyRepo = { cleanExpired: jest.fn() };
const pgm = {
  findMemberBookingsForClass: jest.fn(),
  cancelBooking: jest.fn(),
};
const outbox = { find: jest.fn(), update: jest.fn() };

const job = new ReconcileJob(bookingRepo as any, idempotencyRepo as any, pgm as any, outbox as any);

function booking(overrides: Partial<Booking> = {}): Booking {
  return {
    id: 'b1', userId: 'u1', classId: 100, pgmMemberId: 42, externalId: null,
    status: 'pending_verify', errorCode: 'TEMP_FAIL',
    ...overrides,
  } as Booking;
}

const OLD_ENV = process.env.BACKGROUND_JOBS_ENABLED;
beforeEach(() => {
  jest.clearAllMocks();
  process.env.BACKGROUND_JOBS_ENABLED = 'true';
});
afterAll(() => {
  process.env.BACKGROUND_JOBS_ENABLED = OLD_ENV;
});

describe('ReconcileJob.settle', () => {
  it('confirms when PGM holds exactly one active booking for the class', async () => {
    pgm.findMemberBookingsForClass.mockResolvedValueOnce([{ bookingId: 900, isStandby: false, isCancelled: false }]);
    await job.settle(booking());
    expect(bookingRepo.transition).toHaveBeenCalledWith(
      'b1', 'confirmed', { externalId: '900', errorCode: null }, expect.any(String),
    );
  });

  it('moves to waitlist when the one active PGM booking is a standby', async () => {
    pgm.findMemberBookingsForClass.mockResolvedValueOnce([{ bookingId: 901, isStandby: true, isCancelled: false }]);
    await job.settle(booking());
    expect(bookingRepo.transition).toHaveBeenCalledWith('b1', 'waitlist', expect.anything(), expect.any(String));
  });

  it('fails only when PGM answers and holds no active booking', async () => {
    pgm.findMemberBookingsForClass.mockResolvedValueOnce([{ bookingId: 902, isStandby: false, isCancelled: true }]);
    await job.settle(booking());
    expect(bookingRepo.transition).toHaveBeenCalledWith(
      'b1', 'failed', { errorCode: 'NOT_IN_PGM' }, expect.any(String),
    );
  });

  it('keeps a pending_verify booking untouched when PGM cannot be reached', async () => {
    pgm.findMemberBookingsForClass.mockRejectedValueOnce(new TempFailError());
    await job.settle(booking());
    expect(bookingRepo.transition).not.toHaveBeenCalled();
  });

  it('moves a stale pending booking to pending_verify (not failed) when PGM cannot be reached', async () => {
    pgm.findMemberBookingsForClass.mockRejectedValueOnce(new TempFailError());
    await job.settle(booking({ status: 'pending', errorCode: null }));
    expect(bookingRepo.transition).toHaveBeenCalledWith(
      'b1', 'pending_verify', { errorCode: 'RECONCILE_UNKNOWN' }, expect.any(String),
    );
  });

  it('keeps confirming when PGM holds more than one active booking (ambiguous)', async () => {
    pgm.findMemberBookingsForClass.mockResolvedValueOnce([
      { bookingId: 903, isStandby: false, isCancelled: false },
      { bookingId: 904, isStandby: false, isCancelled: false },
    ]);
    await job.settle(booking());
    expect(bookingRepo.transition).not.toHaveBeenCalled();
  });

  it('releases a declined standby that is still active, then fails as full', async () => {
    pgm.findMemberBookingsForClass.mockResolvedValueOnce([{ bookingId: 777, isStandby: true, isCancelled: false }]);
    pgm.cancelBooking.mockResolvedValueOnce(undefined);
    await job.settle(booking({ externalId: '777', errorCode: WAITLIST_DECLINED }));
    expect(pgm.cancelBooking).toHaveBeenCalledWith(777);
    expect(bookingRepo.transition).toHaveBeenCalledWith(
      'b1', 'failed', { errorCode: 'BOOKING_FULL' }, expect.any(String),
    );
  });

  it('does nothing when background jobs are off', async () => {
    process.env.BACKGROUND_JOBS_ENABLED = 'false';
    await job.reconcilePendingVerify();
    await job.reconcileStalePending();
    await job.reconcileUnknownCancels();
    expect(bookingRepo.findPendingVerify).not.toHaveBeenCalled();
    expect(bookingRepo.findStalePending).not.toHaveBeenCalled();
    expect(pgm.findMemberBookingsForClass).not.toHaveBeenCalled();
  });
});

describe('ReconcileJob.settleCancel', () => {
  const flagged = () => booking({ status: 'confirmed', externalId: '606', errorCode: CANCEL_UNKNOWN });

  it('marks cancelled when PGM shows the booking cancelled', async () => {
    pgm.findMemberBookingsForClass.mockResolvedValueOnce([{ bookingId: 606, isStandby: false, isCancelled: true }]);
    await job.settleCancel(flagged());
    expect(bookingRepo.transition).toHaveBeenCalledWith('b1', 'cancelled', { errorCode: null }, expect.any(String));
  });

  it('keeps the booking and clears the flag when the cancel did not take effect', async () => {
    pgm.findMemberBookingsForClass.mockResolvedValueOnce([{ bookingId: 606, isStandby: false, isCancelled: false }]);
    await job.settleCancel(flagged());
    expect(bookingRepo.transition).not.toHaveBeenCalled();
    expect(bookingRepo.flagError).toHaveBeenCalledWith('b1', null);
  });

  it('leaves the flag for the next run when PGM cannot be reached', async () => {
    pgm.findMemberBookingsForClass.mockRejectedValueOnce(new TempFailError());
    await job.settleCancel(flagged());
    expect(bookingRepo.transition).not.toHaveBeenCalled();
    expect(bookingRepo.flagError).not.toHaveBeenCalled();
  });
});
