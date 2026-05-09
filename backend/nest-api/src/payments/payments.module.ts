import { Module } from '@nestjs/common';
import { TypeOrmModule } from '@nestjs/typeorm';
import { AdyenClient } from './adyen.client';
import { PaymentMethod } from './entities/payment-method.entity';
import { Charge } from './entities/charge.entity';
import { PaymentsService } from './payments.service';
import { PaymentsController } from './payments.controller';
import { NotificationsModule } from '../notifications/notifications.module';

@Module({
  imports: [
    TypeOrmModule.forFeature([PaymentMethod, Charge]),
    NotificationsModule,
  ],
  providers: [AdyenClient, PaymentsService],
  controllers: [PaymentsController],
  exports: [PaymentsService, AdyenClient],
})
export class PaymentsModule {}
