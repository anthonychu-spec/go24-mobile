import { Column, Entity, PrimaryColumn, UpdateDateColumn } from 'typeorm';

@Entity('user_settings')
export class UserSettings {
  @PrimaryColumn({ type: 'varchar', name: 'user_id' })
  userId!: string;

  @Column({ type: 'int', name: 'reminder_minutes', default: 60 })
  reminderMinutes!: number;

  @Column({ type: 'boolean', name: 'auto_waitlist_cancel', default: false })
  autoWaitlistCancel!: boolean;

  @UpdateDateColumn({ type: 'timestamptz', name: 'updated_at' })
  updatedAt!: Date;
}
