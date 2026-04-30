import { Column, CreateDateColumn, Entity, PrimaryGeneratedColumn } from 'typeorm';

@Entity('referrals')
export class Referral {
  @PrimaryGeneratedColumn('uuid') id: string;
  @Column({ name: 'referrer_id', type: 'uuid' }) referrerId: string;
  @Column({ name: 'referrer_code', type: 'varchar', length: 12 }) referrerCode: string;
  @Column({ name: 'referred_user_id', nullable: true, type: 'uuid' }) referredUserId: string | null;
  @Column({ default: 'pending', type: 'varchar', length: 20 }) status: 'pending' | 'completed' | 'rewarded';
  @CreateDateColumn({ name: 'created_at', type: 'timestamptz' }) createdAt: Date;
  @Column({ name: 'completed_at', nullable: true, type: 'timestamptz' }) completedAt: Date | null;
}
