import { Module } from '@nestjs/common';
import { TypeOrmModule } from '@nestjs/typeorm';
import { Referral } from './entities/referral.entity';
import { Banner } from './entities/banner.entity';
import { ReferralService } from './referral.service';
import { ReferralController } from './referral.controller';

@Module({
  imports: [TypeOrmModule.forFeature([Referral, Banner])],
  providers: [ReferralService],
  controllers: [ReferralController],
})
export class ReferralModule {}
