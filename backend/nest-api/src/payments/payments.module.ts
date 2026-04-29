import { Module } from '@nestjs/common';
import { TypeOrmModule } from '@nestjs/typeorm';
import { AdyenClient } from './adyen.client';
import { PaymentMethod } from './entities/payment-method.entity';
import { PaymentsService } from './payments.service';
import { PaymentsController } from './payments.controller';

@Module({
  imports: [TypeOrmModule.forFeature([PaymentMethod])],
  providers: [AdyenClient, PaymentsService],
  controllers: [PaymentsController],
})
export class PaymentsModule {}
