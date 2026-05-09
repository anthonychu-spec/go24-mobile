import { Injectable, Logger } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import axios, { AxiosInstance } from 'axios';

@Injectable()
export class AdyenClient {
  private readonly logger = new Logger(AdyenClient.name);
  private readonly http: AxiosInstance;
  readonly environment: 'TEST' | 'LIVE';
  readonly merchantAccount: string;

  constructor(private readonly cfg: ConfigService) {
    const apiKey = cfg.get<string>('ADYEN_API_KEY');
    this.merchantAccount = cfg.get<string>('ADYEN_MERCHANT_ACCOUNT') ?? '';
    this.environment = (cfg.get<string>('ADYEN_ENVIRONMENT') ?? 'TEST') as 'TEST' | 'LIVE';

    if (!apiKey) throw new Error('ADYEN_API_KEY not set');
    if (!this.merchantAccount) throw new Error('ADYEN_MERCHANT_ACCOUNT not set');

    const baseURL = this.environment === 'LIVE'
      ? 'https://checkout-live.adyen.com/v71'
      : 'https://checkout-test.adyen.com/v71';

    this.http = axios.create({
      baseURL,
      timeout: 10_000,
      headers: {
        'X-API-Key': apiKey,
        'Content-Type': 'application/json',
      },
    });
  }

  async createSession(input: {
    shopperReference: string;
    returnUrl: string;
    shopperEmail?: string;
  }): Promise<{ sessionId: string; sessionData: string }> {
    const res = await this.http.post('/sessions', {
      merchantAccount: this.merchantAccount,
      shopperReference: input.shopperReference,
      shopperEmail: input.shopperEmail,
      amount: { value: 0, currency: 'HKD' },
      returnUrl: input.returnUrl,
      storePaymentMethod: true,
      recurringProcessingModel: 'Subscription',
      shopperInteraction: 'Ecommerce',
      enableRecurring: true,
      channel: 'iOS',                          // overridden by client per platform
    });
    return { sessionId: res.data.id, sessionData: res.data.sessionData };
  }

  async charge(input: {
    shopperReference: string;
    storedPaymentMethodId: string;
    amountHkd: number;
    reference: string;
    shopperEmail?: string;
  }): Promise<{ pspReference: string; resultCode: string; refusalReason?: string }> {
    try {
      const res = await this.http.post('/payments', {
        merchantAccount: this.merchantAccount,
        amount: { value: Math.round(input.amountHkd * 100), currency: 'HKD' },
        reference: input.reference,
        shopperReference: input.shopperReference,
        ...(input.shopperEmail ? { shopperEmail: input.shopperEmail } : {}),
        paymentMethod: {
          type: 'scheme',
          storedPaymentMethodId: input.storedPaymentMethodId,
        },
        shopperInteraction: 'ContAuth',
        recurringProcessingModel: 'Subscription',
      });
      return {
        pspReference: res.data.pspReference,
        resultCode:   res.data.resultCode,
        refusalReason: res.data.refusalReason,
      };
    } catch (err: any) {
      this.logger.error('Adyen charge failed', err?.response?.data ?? err.message);
      throw err;
    }
  }

  verifyWebhookHmac(payload: string, hmacHeader: string): boolean {
    const hmacKey = this.cfg.get<string>('ADYEN_HMAC_KEY');
    if (!hmacKey) return false;
    try {
      const { createHmac } = require('node:crypto');
      const expected = createHmac('sha256', Buffer.from(hmacKey, 'hex'))
        .update(payload)
        .digest('base64');
      return expected === hmacHeader;
    } catch {
      return false;
    }
  }
}
