import { Column, CreateDateColumn, Entity, PrimaryGeneratedColumn } from 'typeorm';

@Entity('booking_events')
export class BookingEvent {
  @PrimaryGeneratedColumn('uuid')
  id: string;

  @Column({ name: 'booking_id', type: 'uuid' })
  bookingId: string;

  @Column({ name: 'from_state', nullable: true, length: 20 })
  fromState: string | null;

  @Column({ name: 'to_state', length: 20 })
  toState: string;

  @Column({ nullable: true, type: 'text' })
  reason: string | null;

  @Column({ nullable: true, length: 100 })
  actor: string | null;

  @CreateDateColumn({ type: 'timestamptz' })
  at: Date;
}
