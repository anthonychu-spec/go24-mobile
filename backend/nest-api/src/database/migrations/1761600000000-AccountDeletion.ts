import { MigrationInterface, QueryRunner } from 'typeorm';

/**
 * Account deletion (backend-plan N4).
 *
 * A deleted member keeps a `users` row (status 'deleted') so de-identified
 * bookings still point somewhere, but the row loses every identifier: email,
 * phone, member codes and the PGM member id. `pgm_member_id` therefore becomes
 * nullable; the unique index allows any number of NULLs, and signing in again
 * later creates a fresh row instead of reviving the old one.
 */
export class AccountDeletion1761600000000 implements MigrationInterface {
  name = 'AccountDeletion1761600000000';

  public async up(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(`
ALTER TABLE public.users ALTER COLUMN pgm_member_id DROP NOT NULL;
ALTER TABLE public.users ADD COLUMN deleted_at timestamp with time zone;
`);
  }

  public async down(queryRunner: QueryRunner): Promise<void> {
    // Deleted rows have no PGM member id; they can't go back under NOT NULL
    await queryRunner.query(`
DELETE FROM public.users WHERE pgm_member_id IS NULL;
ALTER TABLE public.users DROP COLUMN deleted_at;
ALTER TABLE public.users ALTER COLUMN pgm_member_id SET NOT NULL;
`);
  }
}
