
import { Controller, Get, Res } from '@nestjs/common';
import { ApiOperation, ApiTags } from '@nestjs/swagger';
import type { Response } from 'express';
import { MetricsService } from './metrics.service';

@ApiTags('ops')
@Controller('metrics')
export class MetricsController {
  constructor(private readonly svc: MetricsService) {}

  @ApiOperation({ summary: 'Prometheus metrics (scrape endpoint)' })
  @Get()
  async metrics(@Res() res: Response) {
    res.set('Content-Type', this.svc.contentType());
    res.end(await this.svc.metrics());
  }
}
