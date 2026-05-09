import { Column, CreateDateColumn, Entity, PrimaryGeneratedColumn } from 'typeorm';

export type EnrollStatus = 'pending' | 'enrolled' | 'failed';

@Entity('face_enrollments')
export class FaceEnrollment {
  @PrimaryGeneratedColumn('uuid')
  id!: string;

  @Column({ type: 'varchar', name: 'user_id', unique: true })
  userId!: string;

  @Column({ type: 'text', name: 'photo_b64', nullable: true })
  photoB64!: string | null;

  @Column({ type: 'varchar', default: 'pending' })
  status!: EnrollStatus;

  @Column({ type: 'varchar', name: 'suprema_ref', nullable: true })
  supremaRef!: string | null;

  @CreateDateColumn({ type: 'timestamptz', name: 'created_at' })
  createdAt!: Date;

  @Column({ type: 'timestamptz', name: 'enrolled_at', nullable: true })
  enrolledAt!: Date | null;
}
