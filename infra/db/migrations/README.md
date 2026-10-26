# Superseded

These SQL files were never applied by any script. Since 2026-10-26 the schema
comes from TypeORM migrations in `backend/nest-api/src/database/migrations/`
(baseline `1761400000000-Baseline.ts`, built from the staging schema dump plus
the `notifications` and `referrals` tables these files defined).

Kept for history only — do not run them. New schema changes go in a new
TypeORM migration (`npm run migration:create -- src/database/migrations/<Name>`).
