import { BadRequestException, Injectable, Logger, UnauthorizedException } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository } from 'typeorm';
import { ConfigService } from '@nestjs/config';
import { AdyenClient } from './adyen.client';
import { PaymentMethod } from './entities/payment-method.entity';
import { Charge } from './entities/charge.entity';
import { NotificationsService } from '../notifications/notifications.service';

@Injectable()
export class PaymentsService {
  private readonly logger = new Logger(PaymentsService.name);

  constructor(
    private readonly adyen: AdyenClient,
    private readonly cfg: ConfigService,
    private readonly notifications: NotificationsService,
    @InjectRepository(PaymentMethod) private readonly repo: Repository<PaymentMethod>,
    @InjectRepository(Charge)        private readonly chargeRepo: Repository<Charge>,
  ) {}

  // ── Card session (existing) ───────────────────────────────────────────────

  async createCardSession(userId: string, shopperEmail?: string): Promise<{
    sessionId: string; sessionData: string; clientKey: string; environment: string;
  }> {
    let pm = await this.repo.findOne({ where: { userId } });
    if (!pm) {
      pm = this.repo.create({ userId, shopperReference: userId, status: 'pending', adyenEnvironment: this.adyen.environment });
    } else {
      pm.status = 'pending';
    }
    await this.repo.save(pm);

    const { sessionId, sessionData } = await this.adyen.createSession({
      shopperReference: userId,
      returnUrl: 'go24://payment/card-update',
      shopperEmail,
    });

    return { sessionId, sessionData, clientKey: process.env.ADYEN_CLIENT_KEY ?? '', environment: this.adyen.environment };
  }

  // ── Webhook handler ───────────────────────────────────────────────────────

  async handleWebhook(body: object, hmacHeader: string): Promise<void> {
    const raw = JSON.stringify(body);
    if (!this.adyen.verifyWebhookHmac(raw, hmacHeader)) {
      this.logger.warn('Adyen webhook HMAC mismatch');
      throw new UnauthorizedException('Invalid HMAC');
    }

    const notification = body as any;
    const items: any[] = notification?.notificationItems ?? [];

    for (const { NotificationRequestItem: item } of items) {
      if (!item) continue;

      if (item.eventCode === 'RECURRING_CONTRACT') {
        await this.handleRecurringContract(item);
      }

      if (item.eventCode === 'AUTHORISATION') {
        await this.handleAuthorisation(item);
      }
    }
  }

  private async handleRecurringContract(item: any): Promise<void> {
    const shopperRef = item?.additionalData?.shopperReference ?? item?.shopperReference;
    if (!shopperRef) return;

    const pm = await this.repo.findOne({ where: { userId: shopperRef } });
    if (!pm) return;

    if (item.success === 'true') {
      pm.recurringDetailRef = item.additionalData?.['recurring.recurringDetailReference'] ?? null;
      pm.cardSummary  = item.additionalData?.cardSummary ?? null;
      pm.cardBrand    = item.additionalData?.paymentMethod ?? null;
      pm.expiryMonth  = item.additionalData?.expiryDate?.split('/')[0]?.trim() ?? null;
      pm.expiryYear   = item.additionalData?.expiryDate?.split('/')[1]?.trim() ?? null;
      pm.status = 'active';
      this.logger.log(`Card stored for user ${shopperRef}`);
    } else {
      pm.status = 'failed';
      this.logger.warn(`Card storage failed for user ${shopperRef}`);
    }
    await this.repo.save(pm);
  }

  private async handleAuthorisation(item: any): Promise<void> {
    const ref: string  = item.merchantReference ?? '';
    const success      = item.success === 'true';
    const amountValue  = item.amount?.value ?? 0;
    const amountHkd    = amountValue / 100;

    // Parse reference: "{type}-{pgmId}-{timestamp}"
    const [type, pgmIdStr] = ref.split('-');
    const pgmId = parseInt(pgmIdStr ?? '0', 10);

    // Find charge record
    const charge = await this.chargeRepo.findOne({ where: { adyenRef: ref } });
    if (!charge) {
      this.logger.warn(`No charge record found for ref ${ref}`);
      return;
    }

    charge.status = success ? 'authorised' : 'failed';
    await this.chargeRepo.save(charge);

    if (!success) {
      await this.notifications.sendDirectPush(
        charge.userId, '❌ Payment Failed',
        'Your payment could not be processed. Please check your card.',
        { type: 'payment_failed', ref },
      ).catch(() => {});
      return;
    }

    const staffWebhook = this.cfg.get<string>('STAFF_NOTIFICATION_WEBHOOK_URL');

    if (type === 'outstanding') {
      await this.notifications.sendDirectPush(
        charge.userId, '✅ Payment Received',
        `HK$${amountHkd.toFixed(2)} received. Please try entering the gym again.`,
        { type: 'outstanding_paid', url: 'go24://profile' },
      ).catch(() => {});

      if (staffWebhook) {
        const { default: axios } = await import('axios');
        await axios.post(staffWebhook, { event: 'outstanding_paid', pgmId, amountHkd }).catch(() => {});
      }
    }

    if (type === 'daypass') {
      await this.notifications.sendDirectPush(
        charge.userId, '✅ Day Pass Activated',
        'Your day pass is active. You may enter GO24 now.',
        { type: 'daypass_activated', url: 'go24://profile' },
      ).catch(() => {});

      if (staffWebhook) {
        const { default: axios } = await import('axios');
        await axios.post(staffWebhook, { event: 'daypass_paid', pgmId, amountHkd }).catch(() => {});
      }
    }
  }

  // ── Charge saved card (existing) ──────────────────────────────────────────

  async chargeOutstanding(userId: string, amountHkd: number, reference: string): Promise<{
    success: boolean; pspReference?: string; resultCode: string;
  }> {
    const pm = await this.getCard(userId);
    if (!pm?.recurringDetailRef) {
      throw new BadRequestException('No saved card on file. Please add a card first.');
    }
    const result = await this.adyen.charge({
      shopperReference: userId,
      storedPaymentMethodId: pm.recurringDetailRef,
      amountHkd,
      reference,
    });
    return { success: result.resultCode === 'Authorised', pspReference: result.pspReference, resultCode: result.resultCode };
  }

  // ── Day pass ──────────────────────────────────────────────────────────────

  async payDayPass(userId: string, pgmId: number): Promise<{
    success: boolean; resultCode: string; amountCharged: number;
  }> {
    const amountHkd = parseFloat(this.cfg.get<string>('DAY_PASS_PRICE_HKD') ?? '150');
    const pm = await this.getCard(userId);
    if (!pm?.recurringDetailRef) {
      throw new BadRequestException('No saved card. Please add a card first.');
    }

    const ref = `daypass-${pgmId}-${Date.now()}`;

    // Record charge before attempting
    const charge = this.chargeRepo.create({
      userId, amountHkd, description: 'Day Pass',
      type: 'daypass', adyenRef: ref, pgmId, status: 'pending',
    });
    await this.chargeRepo.save(charge);

    const result = await this.adyen.charge({
      shopperReference: userId,
      storedPaymentMethodId: pm.recurringDetailRef,
      amountHkd,
      reference: ref,
    });

    return {
      success: result.resultCode === 'Authorised',
      resultCode: result.resultCode,
      amountCharged: amountHkd,
    };
  }

  // ── Pay outstanding (enhanced — records charge) ───────────────────────────

  async payOutstanding(userId: string, pgmId: number): Promise<{
    success: boolean; pspReference?: string; resultCode: string; amountCharged: number;
  }> {
    // Fetch live amount from backend — never trust client
    // (PgmClient not injected here — amount passed from DashboardService)
    // This method is called from DashboardController which fetches PGM invoices
    throw new BadRequestException('Use DashboardService.payOutstanding()');
  }

  // ── Getters ───────────────────────────────────────────────────────────────

  async getCard(userId: string): Promise<PaymentMethod | null> {
    return this.repo.findOne({ where: { userId, status: 'active' } });
  }
}
