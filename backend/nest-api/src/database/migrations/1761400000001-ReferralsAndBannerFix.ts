import { MigrationInterface, QueryRunner } from 'typeorm';

/**
 * Brings the schema in line with the entities where the staging dump fell short:
 * - `referrals` (Referral entity) was never created on staging; definition from
 *   infra/db/migrations/1746000000000-referral-banners.sql.
 * - `banners.created_at` is non-null in the entity but nullable in the dump.
 */
export class ReferralsAndBannerFix1761400000001 implements MigrationInterface {
  name = 'ReferralsAndBannerFix1761400000001';

  public async up(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(`
CREATE TABLE public.referrals (
    id uuid DEFAULT gen_random_uuid() NOT NULL,
    referrer_id uuid NOT NULL,
    referrer_code character varying(12) NOT NULL,
    referred_user_id uuid,
    status character varying(20) DEFAULT 'pending'::character varying NOT NULL,
    created_at timestamp with time zone DEFAULT now() NOT NULL,
    completed_at timestamp with time zone,
    CONSTRAINT referrals_pkey PRIMARY KEY (id),
    CONSTRAINT referrals_referrer_code_key UNIQUE (referrer_code),
    CONSTRAINT referrals_status_check CHECK (((status)::text = ANY ((ARRAY['pending'::character varying, 'completed'::character varying, 'rewarded'::character varying])::text[])))
);

CREATE INDEX idx_referrals_referrer ON public.referrals USING btree (referrer_id);

CREATE INDEX idx_referrals_referred ON public.referrals USING btree (referred_user_id);

UPDATE public.banners SET created_at = now() WHERE created_at IS NULL;

ALTER TABLE public.banners ALTER COLUMN created_at SET NOT NULL;
`);
  }

  public async down(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(`
ALTER TABLE public.banners ALTER COLUMN created_at DROP NOT NULL;
DROP TABLE IF EXISTS public.referrals CASCADE;
`);
  }
}
