import { MigrationInterface, QueryRunner } from 'typeorm';

/** Monthly visit goal for the Passport screen (backend-plan N6). Null = app shows its default. */
export class VisitGoal1761700000000 implements MigrationInterface {
  name = 'VisitGoal1761700000000';

  public async up(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(`
ALTER TABLE public.user_settings ADD COLUMN visit_goal integer;
ALTER TABLE public.user_settings ADD CONSTRAINT user_settings_visit_goal_check CHECK (visit_goal IS NULL OR (visit_goal >= 1 AND visit_goal <= 31));
`);
  }

  public async down(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(`ALTER TABLE public.user_settings DROP COLUMN visit_goal;`);
  }
}
