import { Controller, Get, Req } from '@nestjs/common';
import { ApiHeader, ApiOperation, ApiTags } from '@nestjs/swagger';
import type { Request } from 'express';
import { BrandService } from './brand.service';
import { headerBrand } from './request-brand';

@ApiTags('app')
@Controller('app-config')
export class AppConfigController {
  constructor(private readonly brands: BrandService) {}

  @ApiOperation({ summary: 'Per-brand app settings read at launch: minimum version, maintenance message, feature switches' })
  @ApiHeader({ name: 'X-App-Brand', required: false, description: 'lab | foundry | go24 | onyx (default go24)' })
  @Get()
  get(@Req() req: Request) {
    return this.brands.appConfig(headerBrand(req));
  }
}
