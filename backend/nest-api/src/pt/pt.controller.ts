import {
  Body, Controller, Get, Param, Post,
  Req, UseGuards, HttpCode,
} from '@nestjs/common';
import { ApiBearerAuth, ApiOperation, ApiTags } from '@nestjs/swagger';
import { IsOptional, IsString, IsNumber } from 'class-validator';
import type { Request } from 'express';
import { JwtAuthGuard } from '../auth/jwt-auth.guard';
import { AuthedUser } from '../auth/jwt.strategy';
import { PtService } from './pt.service';

class VerifySessionDto {
  @IsString() pgmSessionId: string;
  @IsNumber() @IsOptional() pgmTrainerId?: number;
  @IsNumber() @IsOptional() agreementId?: number;
  @IsString() signature: string;           // base64 PNG from SignatureCanvas
  @IsString() @IsOptional() notes?: string;
}

@ApiTags('pt')
@ApiBearerAuth('jwt')
@UseGuards(JwtAuthGuard)
@Controller('pt')
export class PtController {
  constructor(private readonly svc: PtService) {}

  @ApiOperation({ summary: 'My PT agreements (remaining sessions, expiry)' })
  @Get('agreements')
  agreements(@Req() req: Request) {
    const user = req.user as AuthedUser;
    return this.svc.getAgreements(user.pgmId);
  }

  @ApiOperation({ summary: 'My PT sessions (history + verified status)' })
  @Get('sessions')
  sessions(@Req() req: Request) {
    const user = req.user as AuthedUser;
    return this.svc.getSessions(user.pgmId);
  }

  @ApiOperation({ summary: 'Sign to verify PT session completed' })
  @Post('sessions/verify')
  @HttpCode(200)
  verify(@Body() dto: VerifySessionDto, @Req() req: Request) {
    const user = req.user as AuthedUser;
    return this.svc.verifySession({
      userId: user.id,
      pgmSessionId: dto.pgmSessionId,
      pgmTrainerId: dto.pgmTrainerId,
      agreementId: dto.agreementId,
      signature: dto.signature,
      notes: dto.notes,
    });
  }

  @ApiOperation({ summary: 'My verified PT logs' })
  @Get('logs')
  logs(@Req() req: Request) {
    const user = req.user as AuthedUser;
    return this.svc.getMyLogs(user.id);
  }
}
