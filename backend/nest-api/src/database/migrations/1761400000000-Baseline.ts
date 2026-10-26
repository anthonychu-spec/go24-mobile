import { MigrationInterface, QueryRunner } from 'typeorm';

/**
 * Baseline schema for a fresh database.
 *
 * Source: pg_dump --schema-only of the staging DB (2026-09-30 snapshot, every
 * table empty), cleaned of SET/owner/comment lines and the unused pgvector
 * extension, plus the `notifications` table that the dump was missing
 * (infra/db/migrations/1745900000000-stage-7-notifications.sql).
 *
 * Supersedes infra/db/migrations/*.sql and infra/docker/init/02-schema.sql.
 */
export class Baseline1761400000000 implements MigrationInterface {
  name = 'Baseline1761400000000';

  public async up(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(`
CREATE EXTENSION IF NOT EXISTS "uuid-ossp";

CREATE FUNCTION public.touch_updated_at() RETURNS trigger
    LANGUAGE plpgsql
    AS $$
BEGIN
  NEW.updated_at = NOW();
  RETURN NEW;
END;
$$;

CREATE TABLE public.banners (
    id uuid DEFAULT gen_random_uuid() NOT NULL,
    created_at timestamp with time zone DEFAULT now(),
    title text,
    image_url text DEFAULT ''::text NOT NULL,
    link_url text,
    club_ids jsonb,
    display_order integer DEFAULT 0 NOT NULL,
    active boolean DEFAULT true NOT NULL,
    start_at timestamp with time zone,
    end_at timestamp with time zone
);

CREATE TABLE public.booking_events (
    id uuid DEFAULT gen_random_uuid() NOT NULL,
    booking_id uuid NOT NULL,
    from_state character varying(20),
    to_state character varying(20) NOT NULL,
    reason text,
    actor character varying(100),
    at timestamp with time zone DEFAULT now() NOT NULL
);

CREATE TABLE public.bookings (
    id uuid DEFAULT gen_random_uuid() NOT NULL,
    user_id uuid NOT NULL,
    class_id integer NOT NULL,
    external_id text,
    status character varying(20) DEFAULT 'pending'::character varying NOT NULL,
    idempotency_key text NOT NULL,
    pgm_member_id integer,
    error_code character varying(50),
    waitlist_position integer,
    source character varying(10) DEFAULT 'local'::character varying NOT NULL,
    version integer DEFAULT 1 NOT NULL,
    created_at timestamp with time zone DEFAULT now() NOT NULL,
    updated_at timestamp with time zone DEFAULT now() NOT NULL,
    last_synced_at timestamp with time zone,
    class_date date,
    class_name character varying(200),
    club_name character varying(100),
    start_time timestamp with time zone,
    CONSTRAINT bookings_status_check CHECK (((status)::text = ANY ((ARRAY['pending'::character varying, 'confirmed'::character varying, 'failed'::character varying, 'waitlist'::character varying, 'cancelled'::character varying, 'pending_verify'::character varying, 'attended'::character varying, 'no_show'::character varying])::text[]))),
    CONSTRAINT confirmed_has_external CHECK ((((status)::text <> 'confirmed'::text) OR (external_id IS NOT NULL)))
);

CREATE TABLE public.charges (
    id uuid DEFAULT gen_random_uuid() NOT NULL,
    user_id character varying NOT NULL,
    amount_hkd numeric(10,2) NOT NULL,
    description character varying NOT NULL,
    type character varying NOT NULL,
    adyen_ref character varying,
    pgm_id integer,
    status character varying DEFAULT 'pending'::character varying NOT NULL,
    created_at timestamp with time zone DEFAULT now() NOT NULL,
    CONSTRAINT charges_status_check CHECK (((status)::text = ANY ((ARRAY['pending'::character varying, 'authorised'::character varying, 'failed'::character varying])::text[]))),
    CONSTRAINT charges_type_check CHECK (((type)::text = ANY ((ARRAY['outstanding'::character varying, 'daypass'::character varying, 'signup'::character varying])::text[])))
);

CREATE TABLE public.device_tokens (
    id uuid DEFAULT gen_random_uuid() NOT NULL,
    user_id uuid NOT NULL,
    token text NOT NULL,
    platform character varying(10) NOT NULL,
    created_at timestamp with time zone DEFAULT now() NOT NULL,
    updated_at timestamp with time zone DEFAULT now() NOT NULL,
    CONSTRAINT device_tokens_platform_check CHECK (((platform)::text = ANY ((ARRAY['ios'::character varying, 'android'::character varying, 'web'::character varying])::text[])))
);

CREATE TABLE public.face_enrollments (
    id uuid DEFAULT gen_random_uuid() NOT NULL,
    user_id character varying NOT NULL,
    photo_b64 text,
    status character varying DEFAULT 'pending'::character varying NOT NULL,
    suprema_ref character varying,
    created_at timestamp with time zone DEFAULT now() NOT NULL,
    enrolled_at timestamp with time zone,
    CONSTRAINT face_enrollments_status_check CHECK (((status)::text = ANY ((ARRAY['pending'::character varying, 'enrolled'::character varying, 'failed'::character varying])::text[])))
);

CREATE TABLE public.idempotency_keys (
    user_id uuid NOT NULL,
    key text NOT NULL,
    endpoint character varying(100) NOT NULL,
    status character varying(12) DEFAULT 'in_flight'::character varying NOT NULL,
    response jsonb,
    result_kind character varying(12),
    created_at timestamp with time zone DEFAULT now() NOT NULL,
    completed_at timestamp with time zone,
    expires_at timestamp with time zone DEFAULT (now() + '24:00:00'::interval) NOT NULL,
    CONSTRAINT idempotency_keys_result_kind_check CHECK (((result_kind)::text = ANY ((ARRAY['terminal'::character varying, 'transient'::character varying])::text[]))),
    CONSTRAINT idempotency_keys_status_check CHECK (((status)::text = ANY ((ARRAY['in_flight'::character varying, 'done'::character varying])::text[])))
);

CREATE TABLE public.member_milestones (
    id uuid DEFAULT gen_random_uuid() NOT NULL,
    user_id character varying NOT NULL,
    milestone integer NOT NULL,
    unlocked_at timestamp with time zone DEFAULT now() NOT NULL
);

CREATE TABLE public.membership_requests (
    id uuid DEFAULT gen_random_uuid() NOT NULL,
    user_id character varying NOT NULL,
    type character varying DEFAULT 'freeze'::character varying NOT NULL,
    start_date date NOT NULL,
    end_date date NOT NULL,
    reason character varying NOT NULL,
    status character varying DEFAULT 'pending'::character varying NOT NULL,
    created_at timestamp with time zone DEFAULT now() NOT NULL
);

CREATE TABLE public.outbox_events (
    id uuid DEFAULT gen_random_uuid() NOT NULL,
    topic character varying(100) NOT NULL,
    payload jsonb NOT NULL,
    created_at timestamp with time zone DEFAULT now() NOT NULL,
    dispatched_at timestamp with time zone
);

CREATE TABLE public.payment_methods (
    id uuid DEFAULT gen_random_uuid() NOT NULL,
    user_id uuid NOT NULL,
    shopper_reference text NOT NULL,
    recurring_detail_ref text,
    card_summary character varying(4),
    card_brand character varying(20),
    expiry_month character varying(2),
    expiry_year character varying(4),
    status character varying(20) DEFAULT 'pending'::character varying NOT NULL,
    adyen_environment character varying(10) DEFAULT 'TEST'::character varying NOT NULL,
    created_at timestamp with time zone DEFAULT now() NOT NULL,
    updated_at timestamp with time zone DEFAULT now() NOT NULL,
    CONSTRAINT payment_methods_status_check CHECK (((status)::text = ANY ((ARRAY['pending'::character varying, 'active'::character varying, 'failed'::character varying, 'expired'::character varying])::text[])))
);

CREATE TABLE public.pt_logs (
    id uuid DEFAULT gen_random_uuid() NOT NULL,
    user_id uuid NOT NULL,
    pgm_session_id text,
    pgm_trainer_id integer,
    agreement_id integer,
    signed_at timestamp with time zone DEFAULT now() NOT NULL,
    signature text NOT NULL,
    notes text,
    created_at timestamp with time zone DEFAULT now() NOT NULL
);

CREATE TABLE public.sessions (
    id uuid DEFAULT public.uuid_generate_v4() NOT NULL,
    user_id uuid NOT NULL,
    refresh_token_hash character varying(200) NOT NULL,
    device_fingerprint character varying(200),
    device_platform character varying(50),
    revoked boolean DEFAULT false NOT NULL,
    last_seen_at timestamp with time zone,
    expires_at timestamp with time zone NOT NULL,
    created_at timestamp with time zone DEFAULT now() NOT NULL,
    updated_at timestamp with time zone DEFAULT now() NOT NULL
);

CREATE TABLE public.user_favourites (
    id uuid DEFAULT gen_random_uuid() NOT NULL,
    user_id character varying NOT NULL,
    class_template_id character varying NOT NULL,
    class_name character varying NOT NULL,
    instructor_name character varying,
    created_at timestamp with time zone DEFAULT now() NOT NULL
);

CREATE TABLE public.user_settings (
    user_id character varying NOT NULL,
    reminder_minutes integer DEFAULT 60 NOT NULL,
    auto_waitlist_cancel boolean DEFAULT false NOT NULL,
    updated_at timestamp with time zone DEFAULT now() NOT NULL
);

CREATE TABLE public.users (
    id uuid DEFAULT public.uuid_generate_v4() NOT NULL,
    pgm_member_id integer NOT NULL,
    email character varying(150),
    phone character varying(30),
    role character varying(20) DEFAULT 'member'::character varying NOT NULL,
    status character varying(20) DEFAULT 'active'::character varying NOT NULL,
    member_code character varying(30),
    trainer_code character varying(30),
    last_pgm_sync_at timestamp with time zone,
    created_at timestamp with time zone DEFAULT now() NOT NULL,
    updated_at timestamp with time zone DEFAULT now() NOT NULL
);

ALTER TABLE ONLY public.banners
    ADD CONSTRAINT banners_pkey PRIMARY KEY (id);

ALTER TABLE ONLY public.booking_events
    ADD CONSTRAINT booking_events_pkey PRIMARY KEY (id);

ALTER TABLE ONLY public.bookings
    ADD CONSTRAINT bookings_idempotency_key_key UNIQUE (idempotency_key);

ALTER TABLE ONLY public.bookings
    ADD CONSTRAINT bookings_pkey PRIMARY KEY (id);

ALTER TABLE ONLY public.charges
    ADD CONSTRAINT charges_pkey PRIMARY KEY (id);

ALTER TABLE ONLY public.device_tokens
    ADD CONSTRAINT device_tokens_pkey PRIMARY KEY (id);

ALTER TABLE ONLY public.device_tokens
    ADD CONSTRAINT device_tokens_user_id_token_key UNIQUE (user_id, token);

ALTER TABLE ONLY public.face_enrollments
    ADD CONSTRAINT face_enrollments_pkey PRIMARY KEY (id);

ALTER TABLE ONLY public.face_enrollments
    ADD CONSTRAINT face_enrollments_user_id_key UNIQUE (user_id);

ALTER TABLE ONLY public.idempotency_keys
    ADD CONSTRAINT idempotency_keys_pkey PRIMARY KEY (user_id, key);

ALTER TABLE ONLY public.member_milestones
    ADD CONSTRAINT member_milestones_pkey PRIMARY KEY (id);

ALTER TABLE ONLY public.member_milestones
    ADD CONSTRAINT member_milestones_user_id_milestone_key UNIQUE (user_id, milestone);

ALTER TABLE ONLY public.membership_requests
    ADD CONSTRAINT membership_requests_pkey PRIMARY KEY (id);

ALTER TABLE ONLY public.outbox_events
    ADD CONSTRAINT outbox_events_pkey PRIMARY KEY (id);

ALTER TABLE ONLY public.payment_methods
    ADD CONSTRAINT payment_methods_pkey PRIMARY KEY (id);

ALTER TABLE ONLY public.pt_logs
    ADD CONSTRAINT pt_logs_pkey PRIMARY KEY (id);

ALTER TABLE ONLY public.sessions
    ADD CONSTRAINT sessions_pkey PRIMARY KEY (id);

ALTER TABLE ONLY public.user_favourites
    ADD CONSTRAINT user_favourites_pkey PRIMARY KEY (id);

ALTER TABLE ONLY public.user_favourites
    ADD CONSTRAINT user_favourites_user_id_class_template_id_key UNIQUE (user_id, class_template_id);

ALTER TABLE ONLY public.user_settings
    ADD CONSTRAINT user_settings_pkey PRIMARY KEY (user_id);

ALTER TABLE ONLY public.users
    ADD CONSTRAINT users_pkey PRIMARY KEY (id);

CREATE INDEX idx_booking_events_booking ON public.booking_events USING btree (booking_id);

CREATE INDEX idx_bookings_class_id ON public.bookings USING btree (class_id);

CREATE INDEX idx_bookings_pending_old ON public.bookings USING btree (created_at) WHERE ((status)::text = 'pending'::text);

CREATE INDEX idx_bookings_pending_verify ON public.bookings USING btree (updated_at) WHERE ((status)::text = 'pending_verify'::text);

CREATE INDEX idx_bookings_user_status ON public.bookings USING btree (user_id, status);

CREATE INDEX idx_charges_user_id ON public.charges USING btree (user_id);

CREATE INDEX idx_device_tokens_user ON public.device_tokens USING btree (user_id);

CREATE INDEX idx_idempotency_expires ON public.idempotency_keys USING btree (expires_at);

CREATE INDEX idx_idempotency_status ON public.idempotency_keys USING btree (status, created_at);

CREATE INDEX idx_mem_reqs_user ON public.membership_requests USING btree (user_id);

CREATE INDEX idx_milestones_user ON public.member_milestones USING btree (user_id);

CREATE UNIQUE INDEX idx_one_booking_per_day ON public.bookings USING btree (user_id, class_date) WHERE (((status)::text = ANY ((ARRAY['confirmed'::character varying, 'pending'::character varying, 'waitlist'::character varying, 'pending_verify'::character varying])::text[])) AND (class_date IS NOT NULL));

CREATE INDEX idx_outbox_pending ON public.outbox_events USING btree (created_at) WHERE (dispatched_at IS NULL);

CREATE INDEX idx_payment_methods_user ON public.payment_methods USING btree (user_id);

CREATE UNIQUE INDEX idx_payment_methods_user_active ON public.payment_methods USING btree (user_id) WHERE ((status)::text = 'active'::text);

CREATE INDEX idx_pt_logs_session ON public.pt_logs USING btree (pgm_session_id);

CREATE UNIQUE INDEX idx_pt_logs_session_unique ON public.pt_logs USING btree (user_id, pgm_session_id) WHERE (pgm_session_id IS NOT NULL);

CREATE INDEX idx_pt_logs_user ON public.pt_logs USING btree (user_id);

CREATE UNIQUE INDEX idx_sessions_token_hash ON public.sessions USING btree (refresh_token_hash);

CREATE INDEX idx_sessions_user_active ON public.sessions USING btree (user_id, revoked);

CREATE INDEX idx_user_favs_user ON public.user_favourites USING btree (user_id);

CREATE INDEX idx_users_email ON public.users USING btree (email);

CREATE UNIQUE INDEX uq_users_pgm_member_id ON public.users USING btree (pgm_member_id);

CREATE TRIGGER touch_bookings_updated_at BEFORE UPDATE ON public.bookings FOR EACH ROW EXECUTE FUNCTION public.touch_updated_at();

CREATE TRIGGER touch_device_tokens_updated_at BEFORE UPDATE ON public.device_tokens FOR EACH ROW EXECUTE FUNCTION public.touch_updated_at();

CREATE TRIGGER touch_payment_methods_updated_at BEFORE UPDATE ON public.payment_methods FOR EACH ROW EXECUTE FUNCTION public.touch_updated_at();

ALTER TABLE ONLY public.booking_events
    ADD CONSTRAINT booking_events_booking_id_fkey FOREIGN KEY (booking_id) REFERENCES public.bookings(id) ON DELETE CASCADE;

CREATE TABLE public.notifications (
    id uuid DEFAULT gen_random_uuid() NOT NULL,
    user_id uuid NOT NULL,
    type character varying(30) NOT NULL,
    title text NOT NULL,
    body text NOT NULL,
    data jsonb,
    read_at timestamp with time zone,
    created_at timestamp with time zone DEFAULT now() NOT NULL,
    CONSTRAINT notifications_pkey PRIMARY KEY (id)
);

CREATE INDEX idx_notifications_user_unread ON public.notifications USING btree (user_id, created_at DESC) WHERE (read_at IS NULL);

CREATE INDEX idx_notifications_user ON public.notifications USING btree (user_id, created_at DESC);
`);
  }

  public async down(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(`
DROP TABLE IF EXISTS public.banners CASCADE;
DROP TABLE IF EXISTS public.booking_events CASCADE;
DROP TABLE IF EXISTS public.bookings CASCADE;
DROP TABLE IF EXISTS public.charges CASCADE;
DROP TABLE IF EXISTS public.device_tokens CASCADE;
DROP TABLE IF EXISTS public.face_enrollments CASCADE;
DROP TABLE IF EXISTS public.idempotency_keys CASCADE;
DROP TABLE IF EXISTS public.member_milestones CASCADE;
DROP TABLE IF EXISTS public.membership_requests CASCADE;
DROP TABLE IF EXISTS public.outbox_events CASCADE;
DROP TABLE IF EXISTS public.payment_methods CASCADE;
DROP TABLE IF EXISTS public.pt_logs CASCADE;
DROP TABLE IF EXISTS public.sessions CASCADE;
DROP TABLE IF EXISTS public.user_favourites CASCADE;
DROP TABLE IF EXISTS public.user_settings CASCADE;
DROP TABLE IF EXISTS public.users CASCADE;
DROP TABLE IF EXISTS public.notifications CASCADE;
DROP FUNCTION IF EXISTS public.touch_updated_at();
`);
  }
}
