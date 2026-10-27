import { Column, CreateDateColumn, Entity, PrimaryGeneratedColumn } from 'typeorm';

export type CoachingEnquiryStatus = 'received' | 'contacted' | 'closed';

@Entity('coaching_enquiries')
export class CoachingEnquiry {
  @PrimaryGeneratedColumn('uuid')
  id: string;

  @Column({ name: 'user_id', type: 'uuid' })
  userId: string;

  @Column({ type: 'varchar', length: 20 })
  brand: string;

  /** PGM club the member wants coaching at (must belong to the brand) */
  @Column({ name: 'club_id', type: 'int' })
  clubId: number;

  @Column({ type: 'text' })
  goal: string;

  @Column({ name: 'preferred_times', type: 'text', nullable: true })
  preferredTimes: string | null;

  @Column({ type: 'text', nullable: true })
  notes: string | null;

  @Column({ type: 'varchar', length: 20, default: 'received' })
  status: CoachingEnquiryStatus;

  /** When the front desk was notified; null while notification is off (decision B4) */
  @Column({ name: 'notified_at', type: 'timestamptz', nullable: true })
  notifiedAt: Date | null;

  @CreateDateColumn({ name: 'created_at', type: 'timestamptz' })
  createdAt: Date;
}
