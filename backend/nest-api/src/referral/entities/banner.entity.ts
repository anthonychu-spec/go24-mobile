import { Column, CreateDateColumn, Entity, PrimaryGeneratedColumn } from 'typeorm';

@Entity('banners')
export class Banner {
  @PrimaryGeneratedColumn('uuid') id: string;
  @Column({ nullable: true, type: 'text' }) title: string | null;
  @Column({ name: 'image_url', type: 'text' }) imageUrl: string;
  @Column({ name: 'link_url', nullable: true, type: 'text' }) linkUrl: string | null;
  @Column({ name: 'club_ids', type: 'jsonb', nullable: true }) clubIds: string[] | null;
  @Column({ name: 'display_order', default: 0, type: 'int' }) displayOrder: number;
  @Column({ default: true }) active: boolean;
  @Column({ name: 'start_at', nullable: true, type: 'timestamptz' }) startAt: Date | null;
  @Column({ name: 'end_at', nullable: true, type: 'timestamptz' }) endAt: Date | null;
  @CreateDateColumn({ name: 'created_at', type: 'timestamptz' }) createdAt: Date;
}
