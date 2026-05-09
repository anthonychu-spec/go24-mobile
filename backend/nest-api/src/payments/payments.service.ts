import { BadRequestException, Injectable, Logger, NotFoundException, UnauthorizedException } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository } from 'typeorm';
import { ConfigService } from '@nestjs/config';
import { AdyenClient } from './adyen.client';
import { PaymentMethod } from './entities/payment-method.entity';
import { Charge } from './entities/charge.entity';
import { NotificationsService } from '../notifications/notifications.service';
import { PgmClient } from '../pgm-adapter/pgm.client';

@Injectable()
export class PaymentsService {
  private readonly logger = new Logger(PaymentsService.name);

  constructor(
    private readonly adyen: AdyenClient,
    private readonly cfg: ConfigService,
    private readonly notifications: NotificationsService,
    private readonly pgm: PgmClient,
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

  // ── Payment history ───────────────────────────────────────────────────────

  async getPaymentHistory(userId: string, pgmId: number): Promise<any[]> {
    const [chargesRes, invoicesRes] = await Promise.allSettled([
      this.chargeRepo.find({
        where: { userId, status: 'authorised' },
        order: { createdAt: 'DESC' },
        take: 50,
      }),
      this.pgm.get<{ value: any[] }>('/odata/Invoices', {
        $filter: `memberId eq ${pgmId}`,
        $select: 'id,totalAmount,invoiceDate,description,status',
        $top: 50,
        $orderby: 'invoiceDate desc',
      }),
    ]);

    const charges     = chargesRes.status    === 'fulfilled' ? chargesRes.value : [];
    const pgmInvoices = invoicesRes.status   === 'fulfilled' ? (invoicesRes.value.value ?? []) : [];

    const result = [
      ...charges.map(c => ({
        id:               c.id,
        source:           'app' as const,
        date:             c.createdAt.toISOString(),
        amountHkd:        Number(c.amountHkd),
        description:      c.description,
        status:           c.status,
        invoiceAvailable: true,
      })),
      ...pgmInvoices.map((inv: any) => ({
        id:               `pgm-${inv.id}`,
        source:           'pgm' as const,
        date:             inv.invoiceDate ?? new Date().toISOString(),
        amountHkd:        inv.totalAmount ?? 0,
        description:      inv.description ?? 'Membership fee',
        status:           inv.status ?? 'Unknown',
        invoiceAvailable: false,
      })),
    ];

    return result.sort((a, b) => new Date(b.date).getTime() - new Date(a.date).getTime());
  }

  async generateInvoicePdf(userId: string, chargeId: string): Promise<Buffer> {
    const charge = await this.chargeRepo.findOne({ where: { id: chargeId, userId } });
    if (!charge) throw new NotFoundException('Invoice not found');

    // eslint-disable-next-line @typescript-eslint/no-var-requires
    const PDFDocument = require('pdfkit') as any;

    return new Promise<Buffer>((resolve, reject) => {
      const doc    = new PDFDocument({ size: 'A4', margin: 50 });
      const chunks: Buffer[] = [];
      doc.on('data',  (c: Buffer) => chunks.push(c));
      doc.on('end',   () => resolve(Buffer.concat(chunks)));
      doc.on('error', reject);

      doc.fontSize(24).font('Helvetica-Bold').text('GO24 FITNESS', 50, 50);
      doc.fontSize(10).font('Helvetica').fillColor('#888888').text('Payment Receipt', 50, 82);
      doc.moveTo(50, 100).lineTo(545, 100).strokeColor('#eeeeee').stroke();

      doc.fillColor('#333333').fontSize(12).font('Helvetica-Bold').text('Payment Details', 50, 120);
      const rows = [
        ['Date',        new Date(charge.createdAt).toLocaleDateString('en-HK', { day: 'numeric', month: 'long', year: 'numeric' })],
        ['Description', charge.description],
        ['Amount',      `HK$${Number(charge.amountHkd).toFixed(2)}`],
        ['Reference',   charge.adyenRef ?? charge.id],
        ['Status',      'Paid'],
      ];
      let y = 148;
      for (const [label, value] of rows) {
        doc.font('Helvetica').fontSize(10).fillColor('#888888').text(label, 50, y);
        doc.font('Helvetica').fontSize(10).fillColor('#333333').text(String(value), 180, y);
        y += 22;
      }

      doc.fontSize(9).fillColor('#aaaaaa').text('GO24 Fitness · go24.fitness', 50, 720, { align: 'center' });
      doc.end();
    });
  }
}
