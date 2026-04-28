import {
  Column,
  CreateDateColumn,
  Entity,
  Index,
  PrimaryGeneratedColumn,
  UpdateDateColumn,
} from 'typeorm';

export type UserRole = 'member' | 'trainer' | 'admin';
export type UserStatus = 'active' | 'inactive' | 'frozen';

@Entity('users')
@Index('uq_users_pgm_member_id', ['pgmMemberId'], { unique: true })
@Index('idx_users_email', ['email'])
export class User {
  @PrimaryGeneratedColumn('uuid')
  id!: string;

  @Column({ type: 'int', name: 'pgm_member_id' })
  pgmMemberId!: number;

  @Column({ type: 'varchar', length: 150, nullable: true })
  email!: string | null;

  @Column({ type: 'varchar', length: 30, nullable: true })
  phone!: string | null;

  @Column({ type: 'varchar', length: 20, default: 'member' })
  role!: UserRole;

  @Column({ type: 'varchar', length: 20, default: 'active' })
  status!: UserStatus;

  @Column({ type: 'varchar', length: 30, name: 'member_code', nullable: true })
  memberCode!: string | null;

  @Column({ type: 'varchar', length: 30, name: 'trainer_code', nullable: true })
  trainerCode!: string | null;

  @Column({ type: 'timestamptz', name: 'last_pgm_sync_at', nullable: true })
  lastPgmSyncAt!: Date | null;

  @CreateDateColumn({ type: 'timestamptz', name: 'created_at' })
  createdAt!: Date;

  @UpdateDateColumn({ type: 'timestamptz', name: 'updated_at' })
  updatedAt!: Date;
}
