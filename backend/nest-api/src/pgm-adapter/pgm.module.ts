import { Module } from '@nestjs/common';
import { PgmClient } from './pgm.client';
import { PgmAuthAdapter } from './pgm-auth.adapter';

@Module({
  providers: [PgmClient, PgmAuthAdapter],
  exports: [PgmClient, PgmAuthAdapter],
})
export class PgmModule {}
