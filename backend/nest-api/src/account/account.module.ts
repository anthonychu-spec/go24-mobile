import { Module } from '@nestjs/common';
import { AuthModule } from '../auth/auth.module';
import { AccountController, AccountDeletionPageController } from './account.controller';
import { AccountDeletionService } from './account-deletion.service';

@Module({
  imports: [AuthModule],
  controllers: [AccountController, AccountDeletionPageController],
  providers: [AccountDeletionService],
})
export class AccountModule {}
