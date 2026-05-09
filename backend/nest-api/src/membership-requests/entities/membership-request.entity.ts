import { Column, CreateDateColumn, Entity, Index, PrimaryGeneratedColumn } from 'typeorm';

export type RequestStatus = 'pending' | 'approved' | 'rejected';

@Entity('membership_requests')
export class MembershipRequest {
  @PrimaryGeneratedColumn('uuid')
  id!: string;

  @Column({ type: 'varchar', name: 'user_id' })
  @Index()
  userId!: string;

  @Column({ type: 'varchar', default: 'freeze' })
  type!: 'freeze';

  @Column({ type: 'date', name: 'start_date' })
  startDate!: string;

  @Column({ type: 'date', name: 'end_date' })
  endDate!: string;

  @Column({ type: 'varchar' })
  reason!: string;

  @Column({ type: 'varchar', default: 'pending' })
  status!: RequestStatus;

  @CreateDateColumn({ type: 'timestamptz', name: 'created_at' })
  createdAt!: Date;
}
