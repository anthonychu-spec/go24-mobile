import { Column, CreateDateColumn, Entity, PrimaryGeneratedColumn, UpdateDateColumn } from 'typeorm';

@Entity('payment_methods')
export class PaymentMethod {
  @PrimaryGeneratedColumn('uuid')
  id: string;

  @Column({ name: 'user_id', type: 'uuid' })
  userId: string;

  @Column({ name: 'shopper_reference', type: 'text' })
  shopperReference: string;

  @Column({ name: 'recurring_detail_ref', nullable: true, type: 'text' })
  recurringDetailRef: string | null;

  @Column({ name: 'card_summary', nullable: true, type: 'varchar', length: 4 })
  cardSummary: string | null;

  @Column({ name: 'card_brand', nullable: true, type: 'varchar', length: 20 })
  cardBrand: string | null;

  @Column({ name: 'expiry_month', nullable: true, type: 'varchar', length: 2 })
  expiryMonth: string | null;

  @Column({ name: 'expiry_year', nullable: true, type: 'varchar', length: 4 })
  expiryYear: string | null;

  @Column({ default: 'pending', type: 'varchar', length: 20 })
  status: 'pending' | 'active' | 'failed' | 'expired';

  @Column({ name: 'adyen_environment', default: 'TEST', type: 'varchar', length: 10 })
  adyenEnvironment: string;

  @CreateDateColumn({ name: 'created_at', type: 'timestamptz' })
  createdAt: Date;

  @UpdateDateColumn({ name: 'updated_at', type: 'timestamptz' })
  updatedAt: Date;
}
