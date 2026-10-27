import { plainToInstance } from 'class-transformer';
import { validateSync } from 'class-validator';
import { UpdateSettingsDto } from './settings.controller';
import { SettingsService } from './settings.service';

const errors = (body: object) => validateSync(plainToInstance(UpdateSettingsDto, body)).map(e => e.property);

describe('UpdateSettingsDto.visitGoal', () => {
  it('accepts 1–31 and null (clears the goal)', () => {
    expect(errors({ visitGoal: 1 })).toEqual([]);
    expect(errors({ visitGoal: 31 })).toEqual([]);
    expect(errors({ visitGoal: null })).toEqual([]);
  });

  it('rejects 0, more than 31, decimals and text', () => {
    for (const v of [0, 32, 2.5, '12']) expect(errors({ visitGoal: v })).toEqual(['visitGoal']);
  });
});

describe('SettingsService', () => {
  it('returns no visit goal by default', async () => {
    const repo = { findOne: jest.fn().mockResolvedValue(null), upsert: jest.fn() };
    const s = await new SettingsService(repo as any).get('u1');
    expect(s.visitGoal).toBeNull();
  });

  it('saves the visit goal', async () => {
    const repo = { findOne: jest.fn().mockResolvedValue({ userId: 'u1', visitGoal: 12 }), upsert: jest.fn() };
    await new SettingsService(repo as any).update('u1', { visitGoal: 12 });
    expect(repo.upsert).toHaveBeenCalledWith({ userId: 'u1', visitGoal: 12 }, ['userId']);
  });
});
