import {
  Column, CreateDateColumn, Entity,
  PrimaryGeneratedColumn, UpdateDateColumn,
} from 'typeorm';

export type BookingStatus =
  | 'pending' | 'confirmed' | 'failed' | 'waitlist'
  | 'cancelled' | 'pending_verify' | 'attended' | 'no_show';

@Entity('bookings')
export class Booking {
  @PrimaryGeneratedColumn('uuid')
  id: string;

  @Column({ name: 'user_id', type: 'uuid' })
  userId: string;

  @Column({ name: 'class_id', type: 'int' })
  classId: number;

  @Column({ name: 'external_id', nullable: true, type: 'text' })
  externalId: string | null;

  @Column({ name: 'pgm_member_id', nullable: true, type: 'int' })
  pgmMemberId: number | null;

  @Column({ default: 'pending', type: 'varchar', length: 20 })
  status: BookingStatus;

  @Column({ name: 'idempotency_key', unique: true, type: 'text' })
  idempotencyKey: string;

  @Column({ name: 'class_date', type: 'date', nullable: true })
  classDate: string | null;

  @Column({ name: 'class_name', type: 'varchar', length: 200, nullable: true })
  className: string | null;

  @Column({ name: 'club_name', type: 'varchar', length: 100, nullable: true })
  clubName: string | null;

  @Column({ name: 'start_time', type: 'timestamptz', nullable: true })
  startTime: Date | null;

  @Column({ name: 'error_code', nullable: true, type: 'varchar', length: 50 })
  errorCode: string | null;

  @Column({ name: 'waitlist_position', nullable: true, type: 'int' })
  waitlistPosition: number | null;

  @Column({ default: 'local', type: 'varchar', length: 10 })
  source: string;

  @Column({ default: 1, type: 'int' })
  version: number;

  @CreateDateColumn({ name: 'created_at', type: 'timestamptz' })
  createdAt: Date;

  @UpdateDateColumn({ name: 'updated_at', type: 'timestamptz' })
  updatedAt: Date;

  @Column({ name: 'last_synced_at', nullable: true, type: 'timestamptz' })
  lastSyncedAt: Date | null;
}
