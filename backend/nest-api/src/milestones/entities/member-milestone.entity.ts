import { Column, Entity, Index, PrimaryGeneratedColumn, Unique } from 'typeorm';

export const MILESTONE_LEVELS = [10, 50, 100, 200] as const;
export type MilestoneLevel = typeof MILESTONE_LEVELS[number];

export const MILESTONE_META: Record<MilestoneLevel, { emoji: string; title: string; message: string }> = {
  10:  { emoji: '🥉', title: 'First Steps',   message: "You've visited GO24 10 times!" },
  50:  { emoji: '🥈', title: 'Regular',        message: "50 visits — you're a GO24 regular!" },
  100: { emoji: '🥇', title: 'Centurion',      message: '100 visits — incredible commitment!' },
  200: { emoji: '💎', title: 'Legend',          message: "200 visits — you're a GO24 legend!" },
};

@Entity('member_milestones')
@Unique(['userId', 'milestone'])
export class MemberMilestone {
  @PrimaryGeneratedColumn('uuid')
  id!: string;

  @Column({ type: 'varchar', name: 'user_id' })
  @Index()
  userId!: string;

  @Column({ type: 'int' })
  milestone!: number;

  @Column({ type: 'timestamptz', name: 'unlocked_at' })
  unlockedAt!: Date;
}
