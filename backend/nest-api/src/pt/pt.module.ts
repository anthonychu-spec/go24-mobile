import { Module } from '@nestjs/common';
import { TypeOrmModule } from '@nestjs/typeorm';
import { PgmModule } from '../pgm-adapter/pgm.module';
import { PtLog } from './entities/pt-log.entity';
import { PtService } from './pt.service';
import { PtController } from './pt.controller';

@Module({
  imports: [TypeOrmModule.forFeature([PtLog]), PgmModule],
  providers: [PtService],
  controllers: [PtController],
})
export class PtModule {}
