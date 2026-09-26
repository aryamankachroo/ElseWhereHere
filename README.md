# Elsewhere Here

> Find a familiar feeling in New York and discover the place behind it.

This is the frontend for **Elsewhere Here**, built per the DivHacks "Know Your
City" rebuild brief. It is a **mock-first, functional frontend**: three
sample NYC neighborhood pockets, a full interpret → confirm → match → story →
Q&A journey, and a typed service boundary ready to swap onto a real FastAPI
backend later. There is no database, auth, payments, or live model
integration in this build — see [Scope](#scope) below.

## Quick start

```bash
npm install
npm run dev      # http://localhost:5173
npm run build    # type-checks (tsc -b) and produces dist/
npm run lint      # oxlint
```

## Environment variables

Copy `.env.example` to `.env.local` (gitignored) and adjust as needed:

| Variable | Purpose | Default |
| --- | --- | --- |
| `VITE_USE_MOCK_API` | `"false"` switches to the live adapter (`src/lib/liveApi.ts`). Anything else (including unset) uses the mock adapter. | mock |
| `VITE_API_BASE_URL` | Public origin for the live adapter's `/api/v1/*` calls. Leave unset to use relative URLs against the same origin the frontend is served from. | unset |
| `VITE_MAPBOX_ACCESS_TOKEN` | A **public**, browser-restricted Mapbox token (see [Mapbox's token guidance](https://docs.mapbox.com/help/dive-deeper/access-tokens/)). Never put a secret token here. | unset |

## Mock mode

By default the app runs entirely against `src/lib/mockApi.ts` — no network
calls leave the browser. This adapter is deterministic and clearly
self-identifies as sample behavior:

- **`interpret(text)`** does simple keyword matching for the three example
  prompts on the homepage (and close variants), and returns
  `needsClarification: true` with the prompt *"What do you love about it?"*
  for vague or unmatched input (e.g. a bare city name), so the user can pick
  qualities manually. It never claims to be a real model (`mode: 'mock'` is
  always returned).
- **`match(preferences)`** scores the three fixtures by weighted tag overlap
  and returns the top scorer, 2-3 reasons tied to the actual confirmed
  qualities, and an honest `matchLabel` (`'strong connection'` vs
  `'partial connection'` off a fixed threshold) — there is never a fabricated
  percentage.
- **`getPlace` / `listPlaces`** return the three fixtures from
  `src/data/fixtures.ts`. Every fixture has `isSample: true`, `coordinates:
  null` (no location has been verified for this build), and empty
  `citations` arrays — the UI renders "Sources pending" rather than
  inventing links.
- **`ask(...)`** matches a typed question against each fixture's two
  suggested questions; anything else returns the exact copy *"Our current
  sources don't answer that yet."* Answers that do match are explicitly
  labeled as sample, unverified content — never a fabricated quote, source,
  or URL.

Add `?simulateError=1` to any URL (e.g. `http://localhost:5173/matching?simulateError=1`)
to force every mock call to reject, which is the quickest way to exercise the
retry/error states on the matching, result, story, and Q&A screens without
touching the network.

## Adding real place content later

1. Add a new fixture object to `src/data/fixtures.ts` following the
   `PlaceFixture` shape (or replace an existing one once its content has been
   reviewed).
2. Only set `coordinates` once a location has been verified — `null` is the
   safe default and drives the graceful map fallback (`MapFallbackCard`).
3. Populate `citations` with real, checked sources instead of leaving them
   empty; the `SourceDrawer` will render them automatically instead of
   "Sources pending".
4. Once a real backend exists, flip `VITE_USE_MOCK_API=false` (and set
   `VITE_API_BASE_URL` if the backend isn't same-origin). `src/lib/liveApi.ts`
   already implements the same `ElsewhereHereApi` interface against the
   `/api/v1/interpret|match|places|places/:id|ask` routes described in the
   brief, so no component code needs to change.

## Architecture

```
src/
  pages/            HomePage, ConfirmQualitiesPage, MatchingPage,
                     MatchResultPage, StoryMapPage
  components/        Header, AboutDialog, HomeRings, CircleCluster,
                     SourceDrawer, QAPanel, PlaceIllustration
  components/map/    MapView (lazy Mapbox GL integration), MapFallbackCard
  context/           FlowContext — the app's state machine
  lib/               api.ts (adapter switch), mockApi.ts, liveApi.ts,
                     session.ts, useMediaQuery.ts
  types/api.ts       Shared contract types (mirrors the backend LLD)
  data/              fixtures.ts (3 sample profiles), qualityTags.ts
```

`FlowContext` keeps raw memory text in React state only (never persisted).
Confirmed preferences, the active place id, the active story node id, and the
last match result live in `sessionStorage` so a reload doesn't lose progress,
but a browser tab close clears everything. `/story/:placeId` also works with
no prior session — it fetches the place directly from the URL param.

## Scope of this build

Implemented: responsive homepage with ambient/reduced-motion-aware animation,
memory → editable-qualities flow, an overlapping-circle matching animation
driven by the actual confirmed qualities, a two-column match result with
honest partial/strong connection language, a branching story + map
exploration screen, and a cited Q&A panel with pending/answered/insufficient-
evidence/error states.

Deliberately **not** implemented (per the brief): accounts, resident
submissions, citywide coverage, live recommendations, audio/voice, real
model integration, or a database/backend. `src/lib/liveApi.ts` is written to
the same contract as the mock adapter but is not exercised by this build.

## What could not be verified in this environment

- **Live Mapbox rendering.** All three sample fixtures ship
  `coordinates: null` by design (no location has been verified for this
  prototype), so `MapView` always renders `MapFallbackCard` in practice. The
  live Mapbox GL code path (lazy load, dark style, `flyTo`/`jumpTo`,
  `cooperativeGestures`, marker sync with `activeStoryNodeId`, resize
  handling, recenter control) is fully implemented and type-checked, but has
  not been exercised end-to-end with a real `VITE_MAPBOX_ACCESS_TOKEN` and
  real coordinates. Set a token and a fixture's `coordinates` to verify it.
- **Live backend adapter.** `src/lib/liveApi.ts` matches the mock adapter's
  types and the brief's route contracts, but there is no FastAPI backend to
  run it against yet, so it has not been exercised against a real server.
- **In-browser visual/manual QA.** This build environment could not load a
  local dev server inside its browser automation tool (network isolation
  between the shell and the browser sandbox), so the full click-through,
  responsive breakpoints, and keyboard-navigation pass were verified by code
  review and a successful `npm run build` type-check rather than a live
  browser session. Run `npm run dev` locally and click through the flow
  (including `?simulateError=1`) before treating this as demo-ready.
