import { Controller, Get, Module, Req, UseGuards } from '@nestjs/common';
import { ApiBearerAuth, ApiOperation, ApiTags } from '@nestjs/swagger';
import type { Request } from 'express';
import { JwtAuthGuard } from '../auth/jwt-auth.guard';
import { AuthedUser } from '../auth/jwt.strategy';
import { PgmModule } from '../pgm-adapter/pgm.module';
import { SettingsModule } from '../settings/settings.module';
import { PassportService } from './passport.service';

@ApiTags('passport')
@ApiBearerAuth('jwt')
@UseGuards(JwtAuthGuard)
@Controller('me/passport')
export class PassportController {
  constructor(private readonly svc: PassportService) {}

  @ApiOperation({ summary: 'Visits this month, weeks in a row and visit goal (null = could not be read, not zero)' })
  @Get('visits')
  visits(@Req() req: Request) {
    const user = req.user as AuthedUser;
    return this.svc.visits(user.id, user.pgmId, user.brand);
  }
}

@Module({
  imports: [PgmModule, SettingsModule],
  providers: [PassportService],
  controllers: [PassportController],
})
export class PassportModule {}
