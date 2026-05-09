import { Column, CreateDateColumn, Entity, Index, PrimaryGeneratedColumn } from 'typeorm';

export type ChargeType   = 'outstanding' | 'daypass' | 'signup';
export type ChargeStatus = 'pending' | 'authorised' | 'failed';

@Entity('charges')
export class Charge {
  @PrimaryGeneratedColumn('uuid')
  id!: string;

  @Column({ type: 'varchar', name: 'user_id' })
  @Index()
  userId!: string;

  @Column({ type: 'decimal', precision: 10, scale: 2, name: 'amount_hkd' })
  amountHkd!: number;

  @Column({ type: 'varchar' })
  description!: string;

  @Column({ type: 'varchar' })
  type!: ChargeType;

  @Column({ type: 'varchar', name: 'adyen_ref', nullable: true })
  adyenRef!: string | null;

  @Column({ type: 'int', name: 'pgm_id', nullable: true })
  pgmId!: number | null;

  @Column({ type: 'varchar', default: 'pending' })
  status!: ChargeStatus;

  @CreateDateColumn({ type: 'timestamptz', name: 'created_at' })
  createdAt!: Date;
}
