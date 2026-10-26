import { CanActivate, ExecutionContext, Injectable, NotFoundException, SetMetadata } from '@nestjs/common';
import { Reflector } from '@nestjs/core';
import { JwtService } from '@nestjs/jwt';
import type { Request } from 'express';
import { BrandId, Feature, isBrandId } from './brand.constants';
import { BrandService } from './brand.service';
import { headerBrand } from './request-brand';

const FEATURE_KEY = 'brandFeature';

/** Route only exists for brands with this feature on; others get 404. */
export const RequiresFeature = (feature: Feature) => SetMetadata(FEATURE_KEY, feature);

/**
 * Global guard. Runs before controller guards (so before JwtAuthGuard), which is
 * why it reads the brand from a verified bearer token itself rather than req.user.
 * A bad or expired token just falls back to the header; JwtAuthGuard still rejects it.
 */
@Injectable()
export class BrandFeatureGuard implements CanActivate {
  constructor(
    private readonly reflector: Reflector,
    private readonly brands: BrandService,
    private readonly jwt: JwtService,
  ) {}

  async canActivate(ctx: ExecutionContext): Promise<boolean> {
    const feature = this.reflector.getAllAndOverride<Feature | undefined>(FEATURE_KEY, [ctx.getHandler(), ctx.getClass()]);
    if (!feature) return true;

    const req = ctx.switchToHttp().getRequest<Request>();
    const brand = this.tokenBrand(req) ?? headerBrand(req);
    if (await this.brands.isEnabled(brand, feature)) return true;
    throw new NotFoundException();
  }

  private tokenBrand(req: Request): BrandId | null {
    const auth = req.headers.authorization;
    if (!auth?.startsWith('Bearer ')) return null;
    try {
      const payload = this.jwt.verify<{ brand?: unknown }>(auth.slice(7));
      return isBrandId(payload.brand) ? payload.brand : null;
    } catch {
      return null;
    }
  }
}
