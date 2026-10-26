import { BadRequestException } from '@nestjs/common';
import type { Request } from 'express';
import { BRAND_HEADER, BrandId, DEFAULT_BRAND, isBrandId } from './brand.constants';

/** Brand named by the X-App-Brand header; no header → DEFAULT_BRAND; unknown value → 400. */
export function headerBrand(req: Pick<Request, 'headers'>): BrandId {
  const raw = req.headers[BRAND_HEADER];
  if (raw === undefined || raw === '') return DEFAULT_BRAND;
  const value = Array.isArray(raw) ? raw[0] : raw;
  if (!isBrandId(value)) throw new BadRequestException({ code: 'UNKNOWN_BRAND', message: `unknown app brand "${value}"` });
  return value;
}

/** After sign-in the token's brand wins; the header only matters before sign-in. */
export function requestBrand(req: Pick<Request, 'headers'> & { user?: unknown }): BrandId {
  const brand = (req.user as { brand?: unknown } | undefined)?.brand;
  return isBrandId(brand) ? brand : headerBrand(req);
}
