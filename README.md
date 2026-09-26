# Elsewhere Here

> Find a familiar feeling in New York and discover the place behind it.

This is the frontend for **Elsewhere Here**, built per the DivHacks "Know Your
City" rebuild brief. The flow is interpret → confirm → match → story → Q&A.
Matching scores places from your location and your sentence. FastAPI on port
8000 runs that score when `VITE_USE_MOCK_API=false`. There is no database,
auth, or live model yet.

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

## Matching

`src/lib/rankPlaces.ts` and `backend/scoring.py` use the same score. Distance, cost, and localness always count. Tags, time, air, and shade count only when the sentence or a confirmed quality asks for them. A place is left off the list when the walk is 15 minutes or more, or when it is not free and the request is for something free. The result screen shows the top score and the other places still on the list.

Confirmed qualities map onto that score: calm, linger, and reading count as quiet; greenery and waterfront count as outdoors; small food shops count as food; art counts as culture; evening activity checks tonight's hours. Removing a quality on the confirm screen removes it from the score.

Places live in `src/data/places.json`. The three sample stories in `src/data/fixtures.ts` are still labeled sample content. Questions on those stories stay local until a real answer source exists.

Start the API before `npm run dev` when mock mode is off:

```bash
.venv/bin/python -m uvicorn backend.main:app --host 127.0.0.1 --port 8000
```

Add `?simulateError=1` while mock mode is on to force the in-browser adapter to fail.

## Adding real place content later

1. Add a row to `src/data/places.json` with coordinates, tags, free or paid, hours, shade, air, and how local the place is.
2. Add a reviewed story and citations when they exist. Empty citations still render as "Sources pending".

## Architecture

```
src/
  pages/            HomePage, ConfirmQualitiesPage, MatchingPage,
                     MatchResultPage, StoryMapPage
  components/        Header, AboutDialog, CircleCluster, SourceDrawer, QAPanel
  components/map/    MapView (Mapbox GL, walking directions, live location)
  context/           FlowContext — the app's state machine
  lib/               api.ts, mockApi.ts, liveApi.ts, rankPlaces.ts
  types/api.ts       Shared contract types
  data/              places.json (score catalog), fixtures.ts (sample stories), qualityTags.ts
backend/             FastAPI app and the same score
```

`FlowContext` keeps raw memory text in React state only (never persisted).
Confirmed preferences, the active place id, the active story node id, and the
last match result live in `sessionStorage` so a reload doesn't lose progress,
but a browser tab close clears everything. `/story/:placeId` also works with
no prior session — it fetches the place directly from the URL param.

## Scope of this build

Implemented: the splash and homepage, editable qualities, a similarity score, FastAPI on `/api/v1`, a match result with the other nearby places, Mapbox with walking directions from a live location, and sample stories for three places.

Still open: a larger place catalog, reviewed stories and sources, and a real answer model for questions. Accounts, resident submissions, and a database are out of scope.
