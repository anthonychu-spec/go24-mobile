import { Column, CreateDateColumn, Entity, PrimaryColumn } from 'typeorm';

@Entity('idempotency_keys')
export class IdempotencyKey {
  @PrimaryColumn({ type: 'uuid', name: 'user_id' })
  userId: string;

  @PrimaryColumn({ type: 'text' })
  key: string;

  @Column({ length: 100 })
  endpoint: string;

  @Column({ default: 'in_flight', length: 12 })
  status: 'in_flight' | 'done';

  @Column({ type: 'jsonb', nullable: true })
  response: Record<string, unknown> | null;

  @Column({ name: 'result_kind', nullable: true, length: 12 })
  resultKind: 'terminal' | 'transient' | null;

  @CreateDateColumn({ name: 'created_at', type: 'timestamptz' })
  createdAt: Date;

  @Column({ name: 'completed_at', nullable: true, type: 'timestamptz' })
  completedAt: Date | null;

  @Column({ name: 'expires_at', type: 'timestamptz' })
  expiresAt: Date;
}
