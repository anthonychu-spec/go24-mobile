import { BookingService } from './booking.service';

const LAB_CLASS = { id: 1, clubId: 45 };
const GO24_CLASS = { id: 2, clubId: 5 };

const repo = {
  listClasses: jest.fn(async () => [LAB_CLASS, GO24_CLASS]),
  listWeekClasses: jest.fn(async () => ({ '2026-10-27': [LAB_CLASS, GO24_CLASS] })),
  getClass: jest.fn(async (id: number) => (id === 1 ? LAB_CLASS : GO24_CLASS)),
  listMyBookings: jest.fn(async () => [
    { bookingId: 10, clubId: 45 },
    { bookingId: 11, clubId: 5 },
    { bookingId: 12, clubId: null },
  ]),
};
const brands = {
  clubIds: jest.fn(async (brand: string) => (brand === 'lab' ? [45] : [5])),
  ownsClub: jest.fn(async (brand: string, clubId: number) => (brand === 'lab' ? clubId === 45 : clubId === 5)),
};
const svc = new BookingService(repo as any, brands as any);

describe('BookingService (class listing) — brand whitelist', () => {
  it('lists only the brand clubs’ classes', async () => {
    expect(await svc.listClasses({ date: '2026-10-27' }, 'lab')).toEqual([LAB_CLASS]);
    expect(await svc.listWeekClasses({}, 'lab')).toEqual({ '2026-10-27': [LAB_CLASS] });
  });

  it("reports another brand's class as not found", async () => {
    await expect(svc.getClass(1, 'lab')).resolves.toEqual(LAB_CLASS);
    await expect(svc.getClass(2, 'lab')).rejects.toMatchObject({ code: 'CLASS_NOT_FOUND' });
  });

  it("shows only this brand's bookings (unknown club dropped)", async () => {
    const mine = await svc.listMyBookings(7, 'lab');
    expect(mine.map(b => b.bookingId)).toEqual([10]);
  });
});
