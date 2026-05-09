import { BadRequestException, Injectable, Logger, UnauthorizedException } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository } from 'typeorm';
import { AdyenClient } from './adyen.client';
import { PaymentMethod } from './entities/payment-method.entity';

@Injectable()
export class PaymentsService {
  private readonly logger = new Logger(PaymentsService.name);

  constructor(
    private readonly adyen: AdyenClient,
    @InjectRepository(PaymentMethod) private readonly repo: Repository<PaymentMethod>,
  ) {}

  async createCardSession(userId: string, shopperEmail?: string): Promise<{
    sessionId: string;
    sessionData: string;
    clientKey: string;
    environment: string;
  }> {
    // Upsert a pending payment_method row so webhook can match back to user
    let pm = await this.repo.findOne({ where: { userId } });
    if (!pm) {
      pm = this.repo.create({
        userId,
        shopperReference: userId,
        status: 'pending',
        adyenEnvironment: this.adyen.environment,
      });
    } else {
      pm.status = 'pending';
    }
    await this.repo.save(pm);

    const { sessionId, sessionData } = await this.adyen.createSession({
      shopperReference: userId,
      returnUrl: 'go24://payment/card-update',
      shopperEmail,
    });

    return {
      sessionId,
      sessionData,
      clientKey: process.env.ADYEN_CLIENT_KEY ?? '',
      environment: this.adyen.environment,
    };
  }

  async handleWebhook(body: object, hmacHeader: string): Promise<void> {
    const raw = JSON.stringify(body);
    if (!this.adyen.verifyWebhookHmac(raw, hmacHeader)) {
      this.logger.warn('Adyen webhook HMAC mismatch');
      throw new UnauthorizedException('Invalid HMAC');
    }

    const notification = body as any;
    const items: any[] = notification?.notificationItems ?? [];

    for (const { NotificationRequestItem: item } of items) {
      if (item?.eventCode !== 'RECURRING_CONTRACT') continue;
      const shopperRef = item?.additionalData?.shopperReference ?? item?.shopperReference;
      if (!shopperRef) continue;

      const pm = await this.repo.findOne({ where: { userId: shopperRef } });
      if (!pm) continue;

      if (item.success === 'true') {
        pm.recurringDetailRef = item.additionalData?.['recurring.recurringDetailReference'] ?? null;
        pm.cardSummary = item.additionalData?.cardSummary ?? null;
        pm.cardBrand = item.additionalData?.paymentMethod ?? null;
        pm.expiryMonth = item.additionalData?.expiryDate?.split('/')[0]?.trim() ?? null;
        pm.expiryYear = item.additionalData?.expiryDate?.split('/')[1]?.trim() ?? null;
        pm.status = 'active';
        this.logger.log(`Card stored for user ${shopperRef}`);
      } else {
        pm.status = 'failed';
        this.logger.warn(`Card storage failed for user ${shopperRef}`);
      }
      await this.repo.save(pm);
    }
  }

  async getCard(userId: string): Promise<PaymentMethod | null> {
    return this.repo.findOne({ where: { userId, status: 'active' } });
  }

  async chargeOutstanding(
    userId: string,
    amountHkd: number,
    reference: string,
  ): Promise<{ success: boolean; pspReference?: string; resultCode: string }> {
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
    return {
      success: result.resultCode === 'Authorised',
      pspReference: result.pspReference,
      resultCode: result.resultCode,
    };
  }
}
