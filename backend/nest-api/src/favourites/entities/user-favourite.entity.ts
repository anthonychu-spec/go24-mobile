import { Column, CreateDateColumn, Entity, Index, PrimaryGeneratedColumn, Unique } from 'typeorm';

@Entity('user_favourites')
@Unique(['userId', 'classTemplateId'])
export class UserFavourite {
  @PrimaryGeneratedColumn('uuid')
  id!: string;

  @Column({ type: 'varchar', name: 'user_id' })
  @Index()
  userId!: string;

  @Column({ type: 'varchar', name: 'class_template_id' })
  classTemplateId!: string;

  @Column({ type: 'varchar', name: 'class_name' })
  className!: string;

  @Column({ type: 'varchar', name: 'instructor_name', nullable: true })
  instructorName!: string | null;

  @CreateDateColumn({ type: 'timestamptz', name: 'created_at' })
  createdAt!: Date;
}
