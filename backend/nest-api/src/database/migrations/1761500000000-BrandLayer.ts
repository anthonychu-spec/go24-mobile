import { MigrationInterface, QueryRunner } from 'typeorm';

/**
 * Brand layer (backend-plan N1): which PGM clubs and features each app brand gets.
 *
 * Club assignment comes from the PGM club names (read-only probe 2026-10-26,
 * docs/function-review.md §12). Foundry has no clubs yet — its whitelist is
 * open decision #7 in mvp-plan.md. `go24` keeps every feature the current GO24
 * app uses, so requests without a brand header behave as before.
 *
 * Also adds the brand to sessions (kept across refresh) and device tokens, and
 * the PGM club id to bookings so brand checks don't need a PGM lookup.
 */
export class BrandLayer1761500000000 implements MigrationInterface {
  name = 'BrandLayer1761500000000';

  public async up(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(`
CREATE TABLE public.brands (
    id character varying(20) NOT NULL,
    name character varying(100) NOT NULL,
    min_app_version character varying(20),
    maintenance_message text,
    created_at timestamp with time zone DEFAULT now() NOT NULL,
    CONSTRAINT brands_pkey PRIMARY KEY (id)
);

CREATE TABLE public.brand_clubs (
    brand character varying(20) NOT NULL,
    pgm_club_id integer NOT NULL,
    CONSTRAINT brand_clubs_pkey PRIMARY KEY (brand, pgm_club_id),
    CONSTRAINT brand_clubs_brand_fkey FOREIGN KEY (brand) REFERENCES public.brands(id) ON DELETE CASCADE
);

CREATE TABLE public.brand_features (
    brand character varying(20) NOT NULL,
    feature character varying(40) NOT NULL,
    enabled boolean DEFAULT false NOT NULL,
    CONSTRAINT brand_features_pkey PRIMARY KEY (brand, feature),
    CONSTRAINT brand_features_brand_fkey FOREIGN KEY (brand) REFERENCES public.brands(id) ON DELETE CASCADE
);

INSERT INTO public.brands (id, name) VALUES
    ('lab', 'THE LAB by ONYX'),
    ('foundry', 'The Foundry'),
    ('go24', 'GO24 Fitness'),
    ('onyx', 'ONYX by GO24');

-- PGM club ids by name (2026-10-26)
INSERT INTO public.brand_clubs (brand, pgm_club_id) VALUES
    ('lab', 45),                                             -- The LAB by ONYX
    ('go24', 1), ('go24', 3), ('go24', 4), ('go24', 5), ('go24', 6), ('go24', 7),
    ('go24', 34), ('go24', 38), ('go24', 42), ('go24', 43),  -- GO24 Fitness *
    ('onyx', 35), ('onyx', 36), ('onyx', 37), ('onyx', 39),
    ('onyx', 40), ('onyx', 41), ('onyx', 44);                -- ONYX by GO24 *

-- LAB v1: classes only; recovery waits for PGM facility setup (G3), coaching enquiry not built yet
INSERT INTO public.brand_features (brand, feature, enabled) VALUES
    ('lab', 'classes', true),
    ('foundry', 'classes', true);

INSERT INTO public.brand_features (brand, feature, enabled)
SELECT b.brand, f.feature, true
FROM (VALUES ('go24'), ('onyx')) AS b(brand)
CROSS JOIN (VALUES ('classes'), ('member_qr'), ('payments'), ('signup'), ('pt'),
                   ('referral'), ('favourites'), ('freeze')) AS f(feature);

ALTER TABLE public.sessions ADD COLUMN brand character varying(20) DEFAULT 'go24'::character varying NOT NULL;

ALTER TABLE public.device_tokens ADD COLUMN brand character varying(20) DEFAULT 'go24'::character varying NOT NULL;

ALTER TABLE public.bookings ADD COLUMN club_id integer;
`);
  }

  public async down(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(`
ALTER TABLE public.bookings DROP COLUMN club_id;
ALTER TABLE public.device_tokens DROP COLUMN brand;
ALTER TABLE public.sessions DROP COLUMN brand;
DROP TABLE public.brand_features;
DROP TABLE public.brand_clubs;
DROP TABLE public.brands;
`);
  }
}
