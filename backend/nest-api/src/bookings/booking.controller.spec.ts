import { Test } from '@nestjs/testing';
import { BadRequestException } from '@nestjs/common';
import { BookingsController } from './booking.controller';
import { BookingsService } from './booking.service';

const mockSvc = {
  book: jest.fn(),
  cancel: jest.fn(),
  listMine: jest.fn(),
};

const authedReq = () => ({
  user: { id: 'user-uuid-1', pgmId: 42, role: 'member', jti: 'jti-1' },
} as any);

async function buildController() {
  const module = await Test.createTestingModule({
    controllers: [BookingsController],
    providers: [{ provide: BookingsService, useValue: mockSvc }],
  }).compile();
  return module.get(BookingsController);
}

beforeEach(() => jest.clearAllMocks());

describe('BookingsController.book', () => {
  it('throws BadRequestException when Idempotency-Key header is missing', async () => {
    const ctrl = await buildController();
    await expect(
      ctrl.book(undefined as any, { classId: 100 } as any, authedReq()),
    ).rejects.toBeInstanceOf(BadRequestException);
    expect(mockSvc.book).not.toHaveBeenCalled();
  });

  it('delegates to BookingsService.book with correct args', async () => {
    mockSvc.book.mockResolvedValueOnce({ success: true, bookingId: 'b1', status: 'confirmed' });

    const ctrl = await buildController();
    const result = await ctrl.book('idem-key-1', { classId: 100 } as any, authedReq());

    expect(mockSvc.book).toHaveBeenCalledWith({
      userId: 'user-uuid-1',
      pgmId: 42,
      classId: 100,
      idempotencyKey: 'idem-key-1',
      acceptWaitlist: undefined,
    });
    expect(result).toEqual({ success: true, bookingId: 'b1', status: 'confirmed' });
  });
});

describe('BookingsController.cancel', () => {
  it('throws BadRequestException when Idempotency-Key header is missing', async () => {
    const ctrl = await buildController();
    await expect(
      ctrl.cancel('booking-id-1', undefined as any, authedReq()),
    ).rejects.toBeInstanceOf(BadRequestException);
    expect(mockSvc.cancel).not.toHaveBeenCalled();
  });

  it('delegates to BookingsService.cancel with correct args', async () => {
    mockSvc.cancel.mockResolvedValueOnce(undefined);

    const ctrl = await buildController();
    await ctrl.cancel('booking-id-1', 'cancel-key-1', authedReq());

    expect(mockSvc.cancel).toHaveBeenCalledWith('booking-id-1', 'user-uuid-1', 'cancel-key-1');
  });
});

describe('BookingsController.list', () => {
  it('delegates to BookingsService.listMine with status filter', async () => {
    mockSvc.listMine.mockResolvedValueOnce([{ id: 'b1' }]);

    const ctrl = await buildController();
    const result = await ctrl.list('confirmed', authedReq());

    expect(mockSvc.listMine).toHaveBeenCalledWith('user-uuid-1', 'confirmed');
    expect(result).toEqual([{ id: 'b1' }]);
  });

  it('passes undefined status when no filter', async () => {
    mockSvc.listMine.mockResolvedValueOnce([]);

    const ctrl = await buildController();
    await ctrl.list(undefined as any, authedReq());

    expect(mockSvc.listMine).toHaveBeenCalledWith('user-uuid-1', undefined);
  });
});
