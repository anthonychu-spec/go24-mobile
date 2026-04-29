import { IdempotencyRepository } from './idempotency.repo';

const mockQuery = jest.fn();
const mockFindOne = jest.fn();
const mockUpdate = jest.fn();

const mockRepo = {
  manager: { query: mockQuery },
  findOne: mockFindOne,
  update: mockUpdate,
} as any;

function makeRepo() {
  return new IdempotencyRepository(mockRepo);
}

beforeEach(() => jest.clearAllMocks());

describe('IdempotencyRepository.tryClaim', () => {
  it('returns claimed when INSERT succeeds (row returned)', async () => {
    mockQuery.mockResolvedValueOnce([{ user_id: 'u1' }]);

    const result = await makeRepo().tryClaim('u1', 'key1', 'POST /bookings');

    expect(result.kind).toBe('claimed');
    expect(mockFindOne).not.toHaveBeenCalled();
  });

  it('returns already_done when existing row is terminal done', async () => {
    mockQuery.mockResolvedValueOnce([]); // conflict — nothing inserted
    mockFindOne.mockResolvedValueOnce({
      status: 'done',
      resultKind: 'terminal',
      response: { success: true, bookingId: 'b1', status: 'confirmed' },
    });

    const result = await makeRepo().tryClaim('u1', 'key1', 'POST /bookings');

    expect(result.kind).toBe('already_done');
    if (result.kind === 'already_done') {
      expect(result.response).toEqual({ success: true, bookingId: 'b1', status: 'confirmed' });
    }
  });

  it('returns in_flight when existing row is in_flight', async () => {
    mockQuery.mockResolvedValueOnce([]);
    mockFindOne.mockResolvedValueOnce({ status: 'in_flight', resultKind: null, response: null });

    const result = await makeRepo().tryClaim('u1', 'key1', 'POST /bookings');

    expect(result.kind).toBe('in_flight');
  });

  it('returns in_flight when existing row is done but transient (not terminal)', async () => {
    mockQuery.mockResolvedValueOnce([]);
    mockFindOne.mockResolvedValueOnce({
      status: 'done',
      resultKind: 'transient',
      response: { success: false },
    });

    const result = await makeRepo().tryClaim('u1', 'key1', 'POST /bookings');

    expect(result.kind).toBe('in_flight');
  });
});

describe('IdempotencyRepository.complete', () => {
  it('calls repo.update with done status, response and resultKind', async () => {
    await makeRepo().complete('u1', 'key1', { success: true }, 'terminal');

    expect(mockUpdate).toHaveBeenCalledWith(
      { userId: 'u1', key: 'key1' },
      expect.objectContaining({
        status: 'done',
        response: { success: true },
        resultKind: 'terminal',
      }),
    );
  });
});
