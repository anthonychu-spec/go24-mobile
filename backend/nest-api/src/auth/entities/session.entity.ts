import {
  Column,
  CreateDateColumn,
  Entity,
  Index,
  PrimaryGeneratedColumn,
  UpdateDateColumn,
} from 'typeorm';

@Entity('sessions')
@Index('idx_sessions_token_hash', ['refreshTokenHash'], { unique: true })
@Index('idx_sessions_user_active', ['userId', 'revoked'])
export class Session {
  @PrimaryGeneratedColumn('uuid')
  id!: string;

  @Column({ type: 'uuid', name: 'user_id' })
  userId!: string;

  @Column({ type: 'varchar', length: 200, name: 'refresh_token_hash' })
  refreshTokenHash!: string;

  @Column({ type: 'varchar', length: 200, name: 'device_fingerprint', nullable: true })
  deviceFingerprint!: string | null;

  @Column({ type: 'varchar', length: 50, name: 'device_platform', nullable: true })
  devicePlatform!: string | null;

  @Column({ type: 'boolean', default: false })
  revoked!: boolean;

  @Column({ type: 'timestamptz', name: 'last_seen_at', nullable: true })
  lastSeenAt!: Date | null;

  @Column({ type: 'timestamptz', name: 'expires_at' })
  expiresAt!: Date;

  @CreateDateColumn({ type: 'timestamptz', name: 'created_at' })
  createdAt!: Date;

  @UpdateDateColumn({ type: 'timestamptz', name: 'updated_at' })
  updatedAt!: Date;
}
