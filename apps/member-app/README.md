# Member app (THE LAB · The Foundry · GO24)

One Expo codebase (SDK 58, new architecture), one build per brand. Plan: `docs/member-apps-launch-plan.md`.

## Brands

`APP_BRAND=lab|foundry|go24` (default `go24`) picks the brand at build time:

- `app.config.ts` reads `brands/<brand>/brand.ts` (name, bundle id, scheme, icons, splash).
- `metro.config.js` points the `@brand` import at `brands/<brand>/index.ts`, so a build only bundles its own fonts and logo. The app reads it through `src/brand`.
- `src/theme/*` takes colours and fonts from the brand. Screens use the tokens, not hex values.

To add a brand: copy `brands/lab/`, fill in `brand.ts`, add the id to `BRAND_IDS` in `brands/types.ts` and `BRANDS` in `metro.config.js` / `app.config.ts`, add `<brand>-*` profiles to `eas.json`.

Feature switches: `brand.features` are offline defaults. At launch the app reads `GET /v1/app-config` (sent with `X-App-Brand`) and hides what is off. The backend also returns 404 for routes of disabled features.

## Run

Install from the repo root with pnpm (the repo's lockfile is `pnpm-lock.yaml`).

```bash
APP_BRAND=lab EXPO_PUBLIC_API_URL=http://localhost:3000/v1 npx expo start --web
```

PowerShell: `$env:APP_BRAND='lab'; npx expo start --web`. Restart Metro after changing `APP_BRAND`.

`EXPO_PUBLIC_API_URL` is the API root including `/v1`. Without it the app uses `brand.apiBase`, then `http://localhost:3000/v1`.

No server yet? `EXPO_PUBLIC_API_MOCK=1` answers every request inside the app (`src/api/mock`): any email with a 6+ character password signs in, two weeks of LAB classes, one booking tomorrow, past visits. State resets on reload.

## Screens

`brand.layout` picks the screen set. `member` (THE LAB): Home / Book / Passport / Profile tabs with the member pass in the middle (`src/screens/member`, built from `src/ui/kit.tsx`), copy and photos from `brands/<brand>/content.ts`. `classic` (GO24, Foundry until phase 5): the original GO24 screens.

## Builds

`eas.json` has `<brand>-development` / `-preview` / `-production` profiles; each sets `APP_BRAND` and an EAS Update channel of the same name. `runtimeVersion` uses the `fingerprint` policy. When publishing an update, set `APP_BRAND` to match the channel.

Not set up yet (gate G1, no Apple/Google/Expo accounts): `easProjectId` per brand (push and EAS Update stay off until it is set), store credentials, Sentry.
