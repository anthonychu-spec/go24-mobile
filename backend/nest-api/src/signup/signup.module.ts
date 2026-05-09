import { Module } from '@nestjs/common';
import { TypeOrmModule } from '@nestjs/typeorm';
import { FaceEnrollment } from './entities/face-enrollment.entity';
import { AuthModule } from '../auth/auth.module';
import { PgmModule } from '../pgm-adapter/pgm.module';
import { PaymentsModule } from '../payments/payments.module';
import { NotificationsModule } from '../notifications/notifications.module';
import { SignupController } from './signup.controller';
import { SignupService } from './signup.service';

@Module({
  imports: [
    TypeOrmModule.forFeature([FaceEnrollment]),
    AuthModule,
    PgmModule,
    PaymentsModule,
    NotificationsModule,
  ],
  controllers: [SignupController],
  providers: [SignupService],
})
export class SignupModule {}
