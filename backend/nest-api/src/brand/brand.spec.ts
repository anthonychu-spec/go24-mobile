import { BadRequestException, NotFoundException } from '@nestjs/common';
import { JwtService } from '@nestjs/jwt';
import { BrandService } from './brand.service';
import { BrandFeatureGuard } from './brand-feature.guard';
import { headerBrand, requestBrand } from './request-brand';

const SECRET = 'y'.repeat(40);

function brandService() {
  const brands = { find: jest.fn().mockResolvedValue([{ id: 'lab', name: 'THE LAB by ONYX', minAppVersion: '1.0.0', maintenanceMessage: null }]) };
  const clubs = { find: jest.fn().mockResolvedValue([{ brand: 'lab', pgmClubId: 45 }, { brand: 'go24', pgmClubId: 5 }]) };
  const features = { find: jest.fn().mockResolvedValue([{ brand: 'lab', feature: 'classes', enabled: true }, { brand: 'go24', feature: 'payments', enabled: true }]) };
  return { svc: new BrandService(brands as any, clubs as any, features as any), clubs };
}

describe('BrandService', () => {
  it('owns only its whitelisted clubs', async () => {
    const { svc } = brandService();
    expect(await svc.ownsClub('lab', 45)).toBe(true);
    expect(await svc.ownsClub('lab', 5)).toBe(false);
    expect(await svc.ownsClub('lab', null)).toBe(false);
    expect(await svc.clubIds('foundry')).toEqual([]);
  });

  it('treats a feature with no row as off', async () => {
    const { svc } = brandService();
    expect(await svc.isEnabled('lab', 'classes')).toBe(true);
    expect(await svc.isEnabled('lab', 'payments')).toBe(false);
    expect(await svc.isEnabled('go24', 'payments')).toBe(true);
  });

  it('builds the app config with every feature listed', async () => {
    const { svc } = brandService();
    const cfg = await svc.appConfig('lab');
    expect(cfg).toMatchObject({ brand: 'lab', name: 'THE LAB by ONYX', minAppVersion: '1.0.0', maintenanceMessage: null });
    expect(cfg.features.classes).toBe(true);
    expect(cfg.features.payments).toBe(false);
    expect(Object.keys(cfg.features)).toContain('recovery_native');
  });

  it('caches the tables between calls', async () => {
    const { svc, clubs } = brandService();
    await svc.ownsClub('lab', 45);
    await svc.ownsClub('lab', 45);
    expect(clubs.find).toHaveBeenCalledTimes(1);
  });
});

describe('request brand', () => {
  const req = (headers: Record<string, string>, user?: object) => ({ headers, user }) as any;

  it('defaults to go24 without a header, so the existing GO24 app is unchanged', () => {
    expect(headerBrand(req({}))).toBe('go24');
  });

  it('rejects an unknown brand instead of falling back', () => {
    expect(() => headerBrand(req({ 'x-app-brand': 'evil' }))).toThrow(BadRequestException);
  });

  it("prefers the signed-in token's brand over the header", () => {
    expect(requestBrand(req({ 'x-app-brand': 'go24' }, { brand: 'lab' }))).toBe('lab');
  });
});

describe('BrandFeatureGuard', () => {
  const jwt = new JwtService({ secret: SECRET });
  const brands = { isEnabled: jest.fn(async (brand: string, feature: string) => brand === 'go24' && feature === 'payments') };

  function run(feature: string | undefined, headers: Record<string, string>) {
    const reflector = { getAllAndOverride: () => feature } as any;
    const guard = new BrandFeatureGuard(reflector, brands as any, jwt);
    const ctx = {
      getHandler: () => null,
      getClass: () => null,
      switchToHttp: () => ({ getRequest: () => ({ headers }) }),
    } as any;
    return guard.canActivate(ctx);
  }

  it('lets routes without a feature through', async () => {
    await expect(run(undefined, { 'x-app-brand': 'lab' })).resolves.toBe(true);
  });

  it("answers 404 when the brand's feature is off", async () => {
    await expect(run('payments', { 'x-app-brand': 'lab' })).rejects.toBeInstanceOf(NotFoundException);
  });

  it('allows it when the brand has the feature on', async () => {
    await expect(run('payments', {})).resolves.toBe(true); // default go24
  });

  it('uses the brand inside a valid token, not the header', async () => {
    const token = jwt.sign({ sub: 'u1', brand: 'lab' });
    await expect(run('payments', { authorization: `Bearer ${token}`, 'x-app-brand': 'go24' })).rejects.toBeInstanceOf(NotFoundException);
  });
});
