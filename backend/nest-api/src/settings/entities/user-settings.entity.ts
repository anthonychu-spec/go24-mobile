import { Column, Entity, PrimaryColumn, UpdateDateColumn } from 'typeorm';

@Entity('user_settings')
export class UserSettings {
  @PrimaryColumn({ type: 'varchar', name: 'user_id' })
  userId!: string;

  @Column({ type: 'int', name: 'reminder_minutes', default: 60 })
  reminderMinutes!: number;

  @Column({ type: 'boolean', name: 'auto_waitlist_cancel', default: false })
  autoWaitlistCancel!: boolean;

  /** Visits per month the member aims for (Passport); null = not set */
  @Column({ type: 'int', name: 'visit_goal', nullable: true })
  visitGoal!: number | null;

  @UpdateDateColumn({ type: 'timestamptz', name: 'updated_at' })
  updatedAt!: Date;
}
