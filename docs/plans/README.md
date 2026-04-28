# GO24 Mobile Plans

Plan + architecture + execution roadmap for replacing Perfect Gym Pro with custom Member + Trainer apps.

## Files

| File | When to read |
|---|---|
| [`overview.md`](overview.md) | Big picture, roadmap, navigation |
| [`00-architecture.md`](00-architecture.md) | Data model, API endpoints, blueprint, production hardening, operational readiness, security |
| [`01-stage-0-foundation.md`](01-stage-0-foundation.md) | Monorepo + Docker + scaffold |
| [`02-stage-1-auth.md`](02-stage-1-auth.md) | Reuse PGM credentials, JWT |
| [`03-stage-2-pgm-adapter.md`](03-stage-2-pgm-adapter.md) | Circuit breaker, error normalize, shadow read |
| [`04-stage-3-booking.md`](04-stage-3-booking.md) | Idempotency, state machine, transactional outbox |
| [`05-stage-3.5-sync.md`](05-stage-3.5-sync.md) | Webhook / polling, conflict resolver |
| [`06-stage-4-payment.md`](06-stage-4-payment.md) | Adyen Pay-by-Link |
| [`07-stage-5-face.md`](07-stage-5-face.md) | 🌟 Flagship Face check-in |
| [`08-stage-6-pt.md`](08-stage-6-pt.md) | PT module (PGM has none) |
| [`09-stage-7-notifications.md`](09-stage-7-notifications.md) | Push + WhatsApp dispatch |
| [`10-stage-8-ui-polish.md`](10-stage-8-ui-polish.md) | Dashboard redesign, full Trainer app |
| [`11-stage-9-beta.md`](11-stage-9-beta.md) | TestFlight + Play Internal |
| [`12-stage-10-launch.md`](12-stage-10-launch.md) | App Store + rollout |
| [`13-flows.md`](13-flows.md) | Step-by-step logic for 19 critical flows |

## Sync convention

Master copy lives here in repo. The `~/.claude/plans/for-for-refactored-tiger/` location is for Claude Code planning context — keep both in sync, repo is source of truth.
