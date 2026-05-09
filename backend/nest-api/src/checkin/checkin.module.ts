import { Module } from '@nestjs/common';
import { CheckinController } from './checkin.controller';

@Module({
  controllers: [CheckinController],
})
export class CheckinModule {}
