import { Test } from '@nestjs/testing';
import { getRepositoryToken } from '@nestjs/typeorm';
import { BookingsService } from './booking.service';
import { BookingRepository } from './repositories/booking.repo';
import { IdempotencyRepository } from './repositories/idempotency.repo';
import { OutboxEvent } from './entities/outbox-event.entity';
import { BOOKING_REPO } from '../booking/booking.interfaces';
import { TempFailError, InProgressError, BookingFullError } from './errors/index';

const mockBookingRepo = {
  create: jest.fn(),
  transition: jest.fn(),
  findById: jest.fn(),
  findByUser: jest.fn(),
};

const mockIdempotencyRepo = {
  tryClaim: jest.fn(),
  complete: jest.fn(),
};

const mockPgm = {
  bookClass: jest.fn(),
  cancelBooking: jest.fn(),
  listMyBookings: jest.fn(),
};

const mockOutboxRepo = {
  save: jest.fn(),
  create: jest.fn().mockImplementation((d: unknown) => d),
};

const BASE_INPUT = {
  userId: 'user-uuid-1',
  pgmId: 42,
  classId: 100,
  idempotencyKey: 'idem-key-1',
};

async function buildSvc() {
  const module = await Test.createTestingModule({
    providers: [
      BookingsService,
      { provide: BookingRepository, useValue: mockBookingRepo },
      { provide: IdempotencyRepository, useValue: mockIdempotencyRepo },
      { provide: BOOKING_REPO, useValue: mockPgm },
      { provide: getRepositoryToken(OutboxEvent), useValue: mockOutboxRepo },
    ],
  }).compile();
  return module.get(BookingsService);
}

beforeEach(() => jest.clearAllMocks());

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
  });

  it('throws BookingFullError when isStandby but acceptWaitlist is false', async () => {
    mockIdempotencyRepo.tryClaim.mockResolvedValueOnce({ kind: 'claimed' });
    mockBookingRepo.create.mockResolvedValueOnce({ id: 'b3', classId: 100 });
    mockPgm.bookClass.mockResolvedValueOnce({ bookingId: 777, isStandby: true });
    mockBookingRepo.transition.mockResolvedValueOnce({ id: 'b3', status: 'failed' });
    mockIdempotencyRepo.complete.mockResolvedValueOnce(undefined);

    const svc = await buildSvc();
    await expect(svc.book({ ...BASE_INPUT, acceptWaitlist: false })).rejects.toBeInstanceOf(BookingFullError);
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
  it('calls PGM cancelBooking then transitions to cancelled', async () => {
    mockIdempotencyRepo.tryClaim.mockResolvedValueOnce({ kind: 'claimed' });
    mockBookingRepo.findById.mockResolvedValueOnce({
      id: 'b1', userId: BASE_INPUT.userId, classId: 100,
      externalId: '999', pgmMemberId: 42,
    });
    mockPgm.cancelBooking.mockResolvedValueOnce(undefined);
    mockBookingRepo.transition.mockResolvedValueOnce({ id: 'b1', status: 'cancelled' });
    mockIdempotencyRepo.complete.mockResolvedValueOnce(undefined);

    const svc = await buildSvc();
    await svc.cancel('b1', BASE_INPUT.userId, 'cancel-key-1');

    expect(mockPgm.cancelBooking).toHaveBeenCalledWith(42, 100);
    expect(mockBookingRepo.transition).toHaveBeenCalledWith(
      'b1', 'cancelled', {}, 'user cancel', BASE_INPUT.userId,
    );
  });

  it('replays silently when idempotency key already done', async () => {
    mockIdempotencyRepo.tryClaim.mockResolvedValueOnce({
      kind: 'already_done', response: { cancelled: true },
    });

    const svc = await buildSvc();
    await svc.cancel('b1', BASE_INPUT.userId, 'cancel-key-1');

    expect(mockPgm.cancelBooking).not.toHaveBeenCalled();
  });
});
