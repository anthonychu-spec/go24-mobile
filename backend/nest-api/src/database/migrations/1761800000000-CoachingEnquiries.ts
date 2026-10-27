import { MigrationInterface, QueryRunner } from 'typeorm';

/** Coaching enquiries sent from the app (backend-plan N3). */
export class CoachingEnquiries1761800000000 implements MigrationInterface {
  name = 'CoachingEnquiries1761800000000';

  public async up(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(`
CREATE TABLE public.coaching_enquiries (
    id uuid DEFAULT gen_random_uuid() NOT NULL,
    user_id uuid NOT NULL,
    brand character varying(20) NOT NULL,
    club_id integer NOT NULL,
    goal text NOT NULL,
    preferred_times text,
    notes text,
    status character varying(20) DEFAULT 'received'::character varying NOT NULL,
    notified_at timestamp with time zone,
    created_at timestamp with time zone DEFAULT now() NOT NULL,
    CONSTRAINT coaching_enquiries_pkey PRIMARY KEY (id),
    CONSTRAINT coaching_enquiries_status_check CHECK (((status)::text = ANY ((ARRAY['received'::character varying, 'contacted'::character varying, 'closed'::character varying])::text[])))
);

CREATE INDEX idx_coaching_enquiries_user ON public.coaching_enquiries USING btree (user_id, created_at DESC);
`);
  }

  public async down(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(`DROP TABLE IF EXISTS public.coaching_enquiries;`);
  }
}
