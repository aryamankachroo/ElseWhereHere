# Elsewhere, Here

A Know Your City hackathon MVP. Someone describes a place they love; the app interprets an NYC neighborhood with a similar *feeling*, explains the match, offers a two-minute local story, and answers a follow-up from cited sources.

The familiar place is only an entry. The experience stays with what is distinct about the New York neighborhood. The app does not give transit directions, attraction rankings, star ratings, or itineraries, and it never treats a neighborhood as a stand-in for another city or culture.

## Setup

You need Node.js 20+ (this repo was developed with Node 22).

```bash
cd elsewhere-here
cp .env.example .env
npm install
npm run dev
```

Then open [http://127.0.0.1:5173](http://127.0.0.1:5173). Vite proxies `/api` to the Express server on port 3001.

### Environment variables

See `.env.example`.

| Variable | Required | Purpose |
| --- | --- | --- |
| `OPENAI_API_KEY` | No | Used on the **server** to extract qualities, write match copy, and synthesize RAG answers. Leave empty for a full offline demo. |
| `OPENAI_MODEL` | No | Defaults to `gpt-4o-mini`. |
| `PORT` | No | API port, default `3001`. |

Never put the key in client code. Restart `npm run dev` after editing `.env`.

Production-style run (after `npm run build`):

```bash
npm start
```

Serves the Vite build from Express on `PORT`.

## Demo path (under two minutes)

1. Tap **Evening markets** (or describe a place in your own words).
2. Read the interpreted match, reasons, and the difference.
3. Open the two-minute story and pick one path.
4. Ask a question such as *What is Diversity Plaza?* or use the story’s closing question.
5. To see insufficient evidence, ask something the sources do not cover, e.g. *Which restaurant has a Michelin star here?*

## How matching works

Neighborhood “likeness” is **not** left to the model.

1. Each neighborhood profile in `data/neighborhoods.json` has curated vibe tags, per-tag reasons, a difference, and a short note on why those tags exist.
2. The server maps the visitor’s description onto those tags using `data/lexicon.json` (keyword hits). If `OPENAI_API_KEY` is set, the model may add tag ids from the same closed list.
3. Tag overlap is scored with the profile weights. The highest-scoring of the three neighborhoods is chosen.
4. Reasons are the curated sentences for the overlapping tags. If AI is available, those sentences are rewritten for flow—still from the curated facts. If AI is missing or fails, the curated sentences are shown as-is.

The UI states that the match is an **interpretation**, not an objective measure.

## How RAG works

1. Attributable source texts live in `data/sources.json` (title, URL, license, full text).
2. On startup the server splits each text into passages and keeps the parent title and URL.
3. A question is retrieved with TF–IDF cosine similarity against passages **only** from the selected neighborhood.
4. If the best score is too low, or the question is clearly outside the corpus (rankings, Michelin stars, taxi fares), the API returns an insufficient-evidence message and **no** citations.
5. If `OPENAI_API_KEY` is set, the model must answer only from the retrieved passages. Citations are the sources those passages came from—not invented links.
6. Without a key, the API returns a short extractive answer from the top passages plus the same real citations.

There are no fake resident quotes. Personal memories in the visitor’s prompt are not stored as neighborhood facts.

## Seeded neighborhoods

| Neighborhood | Why the tags look like this |
| --- | --- |
| **Jackson Heights, Queens** | Garden-apartment courtyards (LPC historic district) plus dense, multilingual commercial streets (37th Avenue, 74th Street, Diversity Plaza). |
| **Red Hook, Brooklyn** | Peninsula / working waterfront, industrial basins, isolation without a subway, Parks recreation sites, Sandy flooding. |
| **Inwood, Manhattan** | Inwood Hill Park’s forest and salt marsh, hills, island tip, Dyckman Farmhouse as a remnant farm in an apartment landscape. |

Tag rationales are also in each profile and in the match screen under “Why this profile is tagged this way.”

## Source links (curated corpus)

**Jackson Heights**

- [Jackson Heights (Wikipedia)](https://en.wikipedia.org/wiki/Jackson_Heights) — CC BY-SA 4.0
- [Jackson Heights Historic District designation report (LPC, 1993)](https://s-media.nyc.gov/agencies/lpc/lp/1831.pdf)
- [Diversity Plaza (Wikipedia)](https://en.wikipedia.org/wiki/Diversity_Plaza) — CC BY-SA 4.0
- [Travers Park (NYC Parks)](https://www.nycgovparks.org/parks/travers-park)

**Red Hook**

- [Red Hook, Brooklyn (Wikipedia)](https://en.wikipedia.org/wiki/Red_Hook,_Brooklyn) — CC BY-SA 4.0
- [Red Hook Recreation Area (NYC Parks)](https://www.nycgovparks.org/parks/red-hook-recreation-area)
- [Red Hook Play Center (Wikipedia)](https://en.wikipedia.org/wiki/Red_Hook_Play_Center) — CC BY-SA 4.0
- [Effects of Hurricane Sandy in New York (Wikipedia)](https://en.wikipedia.org/wiki/Effects_of_Hurricane_Sandy_in_New_York) — CC BY-SA 4.0

**Inwood**

- [Inwood, Manhattan (Wikipedia)](https://en.wikipedia.org/wiki/Inwood,_Manhattan) — CC BY-SA 4.0
- [Inwood Hill Park (NYC Parks)](https://www.nycgovparks.org/parks/inwood-hill-park)
- [Inwood Hill Park (Wikipedia)](https://en.wikipedia.org/wiki/Inwood_Hill_Park) — CC BY-SA 4.0
- [Dyckman House (Wikipedia)](https://en.wikipedia.org/wiki/Dyckman_House) — CC BY-SA 4.0

Passage text in `data/sources.json` is condensed from those public pages for retrieval. Wikipedia material remains CC BY-SA; LPC and NYC Parks pages are public agency documents/pages.

## What is demo data

- Three hand-built profiles, stories, and lexicon keywords (not a live citywide dataset).
- Source excerpts stored locally so RAG works offline; they are not a complete bibliography.
- Photos in `public/photos/` from Wikimedia Commons (credits on each image).
- Story passages are editorial, grounded in the same sources; they are not interviews.
- Match scores are relative among these three neighborhoods only.

## Project layout

```
data/           neighborhood profiles, lexicon, stories, sources
server/         Express API: match, ask, retrieval
src/            React UI
public/photos/  local Commons images
```

## Scripts

| Command | What it does |
| --- | --- |
| `npm run dev` | Vite + API with reload |
| `npm run build` | Typecheck and production client build |
| `npm start` | Serve built client + API |
