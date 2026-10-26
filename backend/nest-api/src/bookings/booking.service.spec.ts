import { Test } from '@nestjs/testing';
import { getRepositoryToken } from '@nestjs/typeorm';
import { BookingsService, CANCEL_UNKNOWN, WAITLIST_DECLINED } from './booking.service';
import { BookingRepository } from './repositories/booking.repo';
import { IdempotencyRepository } from './repositories/idempotency.repo';
import { OutboxEvent } from './entities/outbox-event.entity';
import { BOOKING_REPO } from '../booking/booking.interfaces';
import { NotificationsService } from '../notifications/notifications.service';
import { SettingsService } from '../settings/settings.service';
import { BrandService } from '../brand/brand.service';
import { TempFailError, InProgressError, BookingFullError, ClassNotFoundError } from './errors/index';

const mockBookingRepo = {
  create: jest.fn(),
  transition: jest.fn(),
  findById: jest.fn(),
  findByUser: jest.fn(),
  flagError: jest.fn(),
};

const mockIdempotencyRepo = {
  tryClaim: jest.fn(),
  complete: jest.fn(),
};

const mockPgm = {
  getClass: jest.fn(),
  bookClass: jest.fn(),
  cancelBooking: jest.fn(),
  listMyBookings: jest.fn(),
  findMemberBookingsForClass: jest.fn(),
};

const mockOutboxRepo = {
  save: jest.fn(),
  create: jest.fn().mockImplementation((d: unknown) => d),
};

const mockNotifications = { sendDirectPush: jest.fn().mockResolvedValue(undefined) };
// LAB owns club 45 only
const mockBrands = {
  ownsClub: jest.fn(async (_b: string, clubId: number | null) => clubId === 45),
  clubIds: jest.fn(async () => [45]),
};
const mockSettings = { get: jest.fn().mockResolvedValue({ reminderMinutes: 0, autoWaitlistCancel: false }) };

const BASE_INPUT = {
  userId: 'user-uuid-1',
  pgmId: 42,
  classId: 100,
  idempotencyKey: 'idem-key-1',
  brand: 'lab' as const,
};

async function buildSvc() {
  const module = await Test.createTestingModule({
    providers: [
      BookingsService,
      { provide: BookingRepository, useValue: mockBookingRepo },
      { provide: IdempotencyRepository, useValue: mockIdempotencyRepo },
      { provide: BOOKING_REPO, useValue: mockPgm },
      { provide: getRepositoryToken(OutboxEvent), useValue: mockOutboxRepo },
      { provide: NotificationsService, useValue: mockNotifications },
      { provide: SettingsService, useValue: mockSettings },
      { provide: BrandService, useValue: mockBrands },
    ],
  }).compile();
  return module.get(BookingsService);
}

beforeEach(() => {
  jest.clearAllMocks();
  // A class two hours from now — inside the 168h booking window
  mockPgm.getClass.mockResolvedValue({
    id: 100, name: 'HIIT', clubId: 45, clubName: 'LAB', startTime: new Date(Date.now() + 2 * 3600_000).toISOString(),
  });
});

describe('BookingsService.book', () => {
  it('replays cached terminal result without calling PGM or creating a booking', async () => {
    const cached = { success: true, bookingId: 'b1', status: 'confirmed' };
    mockIdempotencyRepo.tryClaim.mockResolvedValueOnce({ kind: 'already_done', response: cached });

    const svc = await buildSvc();
    const result = await svc.book(BASE_INPUT);

    expect(result).toEqual(cached);
    expect(mockPgm.bookClass).not.toHaveBeenCalled();
    expect(mockBookingRepo.create).not.toHaveBeenCalled();
  });

  it('throws InProgressError (409) when concurrent request holds the key', async () => {
    mockIdempotencyRepo.tryClaim.mockResolvedValueOnce({ kind: 'in_flight' });

    const svc = await buildSvc();
    await expect(svc.book(BASE_INPUT)).rejects.toBeInstanceOf(InProgressError);
  });

  it('returns confirmed when PGM confirms booking', async () => {
    mockIdempotencyRepo.tryClaim.mockResolvedValueOnce({ kind: 'claimed' });
    mockBookingRepo.create.mockResolvedValueOnce({ id: 'b1', classId: 100 });
    mockPgm.bookClass.mockResolvedValueOnce({ bookingId: 999, isStandby: false });
    mockBookingRepo.transition.mockResolvedValueOnce({ id: 'b1', status: 'confirmed' });
    mockIdempotencyRepo.complete.mockResolvedValueOnce(undefined);

    const svc = await buildSvc();
    const result = await svc.book(BASE_INPUT);

    expect(result.status).toBe('confirmed');
    expect(result.bookingId).toBe('b1');
    expect(mockBookingRepo.transition).toHaveBeenCalledWith(
      'b1', 'confirmed', { externalId: '999' }, 'PGM confirmed',
    );
    expect(mockIdempotencyRepo.complete).toHaveBeenCalledWith(
      BASE_INPUT.userId, BASE_INPUT.idempotencyKey,
      expect.objectContaining({ status: 'confirmed' }), 'terminal',
    );
  });

  it('returns waitlist when PGM returns isStandby and acceptWaitlist is true', async () => {
    mockIdempotencyRepo.tryClaim.mockResolvedValueOnce({ kind: 'claimed' });
    mockBookingRepo.create.mockResolvedValueOnce({ id: 'b2', classId: 100 });
    mockPgm.bookClass.mockResolvedValueOnce({ bookingId: 888, isStandby: true });
    mockBookingRepo.transition.mockResolvedValueOnce({ id: 'b2', status: 'waitlist' });
    mockIdempotencyRepo.complete.mockResolvedValueOnce(undefined);

    const svc = await buildSvc();
    const result = await svc.book({ ...BASE_INPUT, acceptWaitlist: true });

    expect(result.status).toBe('waitlist');
    expect(mockBookingRepo.transition).toHaveBeenCalledWith(
      'b2', 'waitlist', expect.any(Object), 'PGM returned standby',
    );
    expect(mockPgm.cancelBooking).not.toHaveBeenCalled();
  });

  it('declined waitlist: cancels the PGM standby booking it was given, then fails as full', async () => {
    mockIdempotencyRepo.tryClaim.mockResolvedValueOnce({ kind: 'claimed' });
    mockBookingRepo.create.mockResolvedValueOnce({ id: 'b3', classId: 100 });
    mockPgm.bookClass.mockResolvedValueOnce({ bookingId: 777, isStandby: true });
    mockPgm.cancelBooking.mockResolvedValueOnce(undefined);

    const svc = await buildSvc();
    await expect(svc.book({ ...BASE_INPUT, acceptWaitlist: false })).rejects.toBeInstanceOf(BookingFullError);

    expect(mockPgm.cancelBooking).toHaveBeenCalledWith(777);
    expect(mockBookingRepo.transition).toHaveBeenCalledWith(
      'b3', 'failed', { externalId: '777', errorCode: 'BOOKING_FULL' }, expect.any(String),
    );
    expect(mockIdempotencyRepo.complete).toHaveBeenCalledWith(
      BASE_INPUT.userId, BASE_INPUT.idempotencyKey, expect.objectContaining({ status: 'failed' }), 'terminal',
    );
  });

  it('declined waitlist: if releasing the standby fails, leaves it for reconcile (pending_verify)', async () => {
    mockIdempotencyRepo.tryClaim.mockResolvedValueOnce({ kind: 'claimed' });
    mockBookingRepo.create.mockResolvedValueOnce({ id: 'b5', classId: 100 });
    mockPgm.bookClass.mockResolvedValueOnce({ bookingId: 555, isStandby: true });
    mockPgm.cancelBooking.mockRejectedValueOnce(new TempFailError());

    const svc = await buildSvc();
    await expect(svc.book({ ...BASE_INPUT, acceptWaitlist: false })).rejects.toBeInstanceOf(BookingFullError);

    expect(mockBookingRepo.transition).toHaveBeenCalledWith(
      'b5', 'pending_verify', { externalId: '555', errorCode: WAITLIST_DECLINED }, expect.any(String),
    );
    expect(mockBookingRepo.transition).not.toHaveBeenCalledWith('b5', 'failed', expect.anything(), expect.anything());
  });

  it('transitions to pending_verify and caches as transient when PGM throws TempFailError', async () => {
    mockIdempotencyRepo.tryClaim.mockResolvedValueOnce({ kind: 'claimed' });
    mockBookingRepo.create.mockResolvedValueOnce({ id: 'b4', classId: 100 });
    mockPgm.bookClass.mockRejectedValueOnce(new TempFailError());
    mockBookingRepo.transition.mockResolvedValueOnce({ id: 'b4', status: 'pending_verify' });
    mockIdempotencyRepo.complete.mockResolvedValueOnce(undefined);

    const svc = await buildSvc();
    await expect(svc.book(BASE_INPUT)).rejects.toBeInstanceOf(TempFailError);

    expect(mockBookingRepo.transition).toHaveBeenCalledWith(
      'b4', 'pending_verify',
      expect.objectContaining({ errorCode: 'TEMP_FAIL' }),
      expect.any(String),
    );
    expect(mockIdempotencyRepo.complete).toHaveBeenCalledWith(
      BASE_INPUT.userId, BASE_INPUT.idempotencyKey,
      expect.any(Object), 'transient',
    );
  });
});

describe('BookingsService.cancel', () => {
  it('cancels exactly the stored PGM booking (CancelSingleBooking by id), then transitions to cancelled', async () => {
    mockIdempotencyRepo.tryClaim.mockResolvedValueOnce({ kind: 'claimed' });
    mockBookingRepo.findById.mockResolvedValueOnce({
      id: 'b1', userId: BASE_INPUT.userId, classId: 100, clubId: 45,
      externalId: '999', pgmMemberId: 42,
    });
    mockPgm.cancelBooking.mockResolvedValueOnce(undefined);
    mockBookingRepo.transition.mockResolvedValueOnce({ id: 'b1', status: 'cancelled' });
    mockIdempotencyRepo.complete.mockResolvedValueOnce(undefined);

    const svc = await buildSvc();
    await svc.cancel('b1', BASE_INPUT.userId, 'cancel-key-1', 'lab');

    expect(mockPgm.cancelBooking).toHaveBeenCalledTimes(1);
    expect(mockPgm.cancelBooking).toHaveBeenCalledWith(999);
    expect(mockBookingRepo.transition).toHaveBeenCalledWith(
      'b1', 'cancelled', {}, 'user cancel', BASE_INPUT.userId,
    );
  });

  it('cancel timed out in PGM: keeps the booking, flags it for reconcile, does not mark cancelled', async () => {
    mockIdempotencyRepo.tryClaim.mockResolvedValueOnce({ kind: 'claimed' });
    mockBookingRepo.findById.mockResolvedValueOnce({
      id: 'b6', userId: BASE_INPUT.userId, classId: 100, clubId: 45, externalId: '606', pgmMemberId: 42,
    });
    mockPgm.cancelBooking.mockRejectedValueOnce(new TempFailError());

    const svc = await buildSvc();
    await expect(svc.cancel('b6', BASE_INPUT.userId, 'cancel-key-2', 'lab')).rejects.toBeInstanceOf(TempFailError);

    expect(mockBookingRepo.flagError).toHaveBeenCalledWith('b6', CANCEL_UNKNOWN);
    expect(mockBookingRepo.transition).not.toHaveBeenCalled();
    expect(mockIdempotencyRepo.complete).toHaveBeenCalledWith(
      BASE_INPUT.userId, 'cancel-key-2', expect.objectContaining({ cancelled: false }), 'transient',
    );
  });

  it("refuses to cancel another user's booking", async () => {
    mockIdempotencyRepo.tryClaim.mockResolvedValueOnce({ kind: 'claimed' });
    mockBookingRepo.findById.mockResolvedValueOnce({
      id: 'b7', userId: 'someone-else', classId: 100, externalId: '707', pgmMemberId: 99,
    });

    const svc = await buildSvc();
    await expect(svc.cancel('b7', BASE_INPUT.userId, 'cancel-key-3', 'lab')).rejects.toThrow('Booking not found');
    expect(mockPgm.cancelBooking).not.toHaveBeenCalled();
  });

  it('replays silently when idempotency key already done', async () => {
    mockIdempotencyRepo.tryClaim.mockResolvedValueOnce({
      kind: 'already_done', response: { cancelled: true },
    });

    const svc = await buildSvc();
    await svc.cancel('b1', BASE_INPUT.userId, 'cancel-key-1', 'lab');

    expect(mockPgm.cancelBooking).not.toHaveBeenCalled();
  });
});

describe('BookingsService brand whitelist', () => {
  it("refuses to book another brand's class, before touching PGM or the DB", async () => {
    mockPgm.getClass.mockResolvedValueOnce({ id: 200, name: 'GO24 Spin', clubId: 5, startTime: new Date(Date.now() + 3600_000).toISOString() });
    const svc = await buildSvc();
    await expect(svc.book({ ...BASE_INPUT, classId: 200 })).rejects.toBeInstanceOf(ClassNotFoundError);
    expect(mockIdempotencyRepo.tryClaim).not.toHaveBeenCalled();
    expect(mockPgm.bookClass).not.toHaveBeenCalled();
  });

  it('stores the club id on the booking', async () => {
    mockIdempotencyRepo.tryClaim.mockResolvedValueOnce({ kind: 'claimed' });
    mockBookingRepo.create.mockResolvedValueOnce({ id: 'b8', classId: 100 });
    mockPgm.bookClass.mockResolvedValueOnce({ bookingId: 808, isStandby: false });
    const svc = await buildSvc();
    await svc.book(BASE_INPUT);
    expect(mockBookingRepo.create).toHaveBeenCalledWith(expect.objectContaining({ clubId: 45 }));
  });

  it("cannot cancel its own booking at another brand's club through this brand's app", async () => {
    mockIdempotencyRepo.tryClaim.mockResolvedValueOnce({ kind: 'claimed' });
    mockBookingRepo.findById.mockResolvedValueOnce({
      id: 'b9', userId: BASE_INPUT.userId, classId: 300, clubId: 5, externalId: '909', pgmMemberId: 42,
    });
    const svc = await buildSvc();
    await expect(svc.cancel('b9', BASE_INPUT.userId, 'k9', 'lab')).rejects.toThrow('Booking not found');
    expect(mockPgm.cancelBooking).not.toHaveBeenCalled();
  });

  it("lists only this brand's bookings", async () => {
    mockBookingRepo.findByUser.mockResolvedValueOnce([
      { id: 'lab-1', classId: 100, clubId: 45 },
      { id: 'go24-1', classId: 200, clubId: 5 },
    ]);
    mockPgm.getClass.mockImplementation(async (id: number) => ({ id, name: 'X', clubId: id === 100 ? 45 : 5, startTime: '' }));
    const svc = await buildSvc();
    const list = (await svc.listMine(BASE_INPUT.userId, 'lab')) as Array<{ id: string }>;
    expect(list.map(b => b.id)).toEqual(['lab-1']);
  });
});
