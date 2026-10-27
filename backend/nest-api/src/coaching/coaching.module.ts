import { Module } from '@nestjs/common';
import { TypeOrmModule } from '@nestjs/typeorm';
import { CoachingController } from './coaching.controller';
import { CoachingEnquiry } from './coaching-enquiry.entity';
import { CoachingService } from './coaching.service';

@Module({
  imports: [TypeOrmModule.forFeature([CoachingEnquiry])],
  providers: [CoachingService],
  controllers: [CoachingController],
})
export class CoachingModule {}
