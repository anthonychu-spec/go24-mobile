import { Column, CreateDateColumn, Entity, PrimaryGeneratedColumn } from 'typeorm';

@Entity('pt_logs')
export class PtLog {
  @PrimaryGeneratedColumn('uuid')
  id: string;

  @Column({ name: 'user_id', type: 'uuid' })
  userId: string;

  @Column({ name: 'pgm_session_id', nullable: true, type: 'text' })
  pgmSessionId: string | null;

  @Column({ name: 'pgm_trainer_id', nullable: true, type: 'int' })
  pgmTrainerId: number | null;

  @Column({ name: 'agreement_id', nullable: true, type: 'int' })
  agreementId: number | null;

  @Column({ name: 'signed_at', type: 'timestamptz' })
  signedAt: Date;

  @Column({ type: 'text' })
  signature: string; // base64 PNG

  @Column({ nullable: true, type: 'text' })
  notes: string | null;

  @CreateDateColumn({ name: 'created_at', type: 'timestamptz' })
  createdAt: Date;
}
