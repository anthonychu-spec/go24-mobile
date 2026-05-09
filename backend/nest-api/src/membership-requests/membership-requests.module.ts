import { Module } from '@nestjs/common';
import { TypeOrmModule } from '@nestjs/typeorm';
import { MembershipRequest } from './entities/membership-request.entity';
import { MembershipRequestsController } from './membership-requests.controller';
import { MembershipRequestsService } from './membership-requests.service';

@Module({
  imports: [TypeOrmModule.forFeature([MembershipRequest])],
  controllers: [MembershipRequestsController],
  providers: [MembershipRequestsService],
})
export class MembershipRequestsModule {}
