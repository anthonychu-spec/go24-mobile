import {
  Body, Controller, Get, Headers, HttpCode,
  Param, Post, Req, Res, UseGuards,
} from '@nestjs/common';
import type { Response } from 'express';
import { ApiBearerAuth, ApiOperation, ApiTags } from '@nestjs/swagger';
import type { Request } from 'express';
import { JwtAuthGuard } from '../auth/jwt-auth.guard';
import { AuthedUser } from '../auth/jwt.strategy';
import { PaymentsService } from './payments.service';

@ApiTags('payments')
@Controller('payments')
export class PaymentsController {
  constructor(private readonly svc: PaymentsService) {}

  @ApiOperation({ summary: 'Create Adyen session for card update' })
  @ApiBearerAuth('jwt')
  @UseGuards(JwtAuthGuard)
  @Post('card-session')
  @HttpCode(200)
  cardSession(@Req() req: Request) {
    const user = req.user as AuthedUser;
    return this.svc.createCardSession(user.id);
  }

  @ApiOperation({ summary: 'Get current saved card (masked)' })
  @ApiBearerAuth('jwt')
  @UseGuards(JwtAuthGuard)
  @Get('card')
  getCard(@Req() req: Request) {
    const user = req.user as AuthedUser;
    return this.svc.getCard(user.id);
  }

  @ApiOperation({ summary: 'Buy a day pass using saved card' })
  @ApiBearerAuth('jwt')
  @UseGuards(JwtAuthGuard)
  @Post('pay-daypass')
  @HttpCode(200)
  payDayPass(@Req() req: Request) {
    const user = req.user as AuthedUser;
    return this.svc.payDayPass(user.id, user.pgmId);
  }

  @ApiOperation({ summary: 'Payment history (charges + PGM invoices)' })
  @ApiBearerAuth('jwt')
  @UseGuards(JwtAuthGuard)
  @Get('/me/payments')
  getPaymentHistory(@Req() req: Request) {
    const user = req.user as AuthedUser;
    return this.svc.getPaymentHistory(user.id, user.pgmId);
  }

  @ApiOperation({ summary: 'Download invoice PDF' })
  @ApiBearerAuth('jwt')
  @UseGuards(JwtAuthGuard)
  @Get('/me/payments/:id/invoice')
  async downloadInvoice(
    @Req() req: Request,
    @Param('id') id: string,
    @Res() res: Response,
  ) {
    const pdf = await this.svc.generateInvoicePdf((req.user as AuthedUser).id, id);
    res.setHeader('Content-Type', 'application/pdf');
    res.setHeader('Content-Disposition', `attachment; filename="go24-invoice-${id}.pdf"`);
    res.end(pdf);
  }

  @ApiOperation({ summary: 'Adyen webhook (RECURRING_CONTRACT + AUTHORISATION)' })
  @Post('webhook/adyen')
  @HttpCode(200)
  async adyenWebhook(
    @Body() body: object,
    @Headers('hmac-signature') hmac: string,
  ) {
    await this.svc.handleWebhook(body, hmac ?? '');
    return { notificationResponse: '[accepted]' };
  }
}
