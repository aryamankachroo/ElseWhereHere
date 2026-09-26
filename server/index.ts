import "dotenv/config";
import cors from "cors";
import express from "express";
import { join, dirname } from "node:path";
import { fileURLToPath } from "node:url";
import { lexiconData, neighborhoodData, sourceData, storyData } from "./data.js";
import { matchDescription } from "./match.js";
import { askNeighborhood } from "./ask.js";
import { fetchPermittedEventRecords, parseBorough, type NycBorough } from "./events.js";
import { discoverNearbyArt, parseNycPoint } from "./discover.js";
import { exploreCitywide, parseCitywideInterest } from "./citywide.js";
import { parsePlaceInterests, recommendPlaces } from "./places.js";

const app = express();
const port = Number(process.env.PORT) || 3001;
const root = join(dirname(fileURLToPath(import.meta.url)), "..");

app.use(cors());
app.use(express.json({ limit: "32kb" }));

app.get("/api/health", (_req, res) => {
  res.json({ ok: true, ai: Boolean(process.env.OPENAI_API_KEY?.trim()) });
});

app.get("/api/bootstrap", (_req, res) => {
  res.json({
    examples: lexiconData.examples,
    neighborhoods: neighborhoodData.neighborhoods.map((n) => ({
      id: n.id,
      name: n.name,
      borough: n.borough,
      shortLine: n.shortLine,
      photo: n.photo,
      explorePrompt: n.explorePrompt,
      latitude: n.latitude,
      longitude: n.longitude,
      visitGuide: n.visitGuide,
    })),
    stories: storyData.stories,
    sourceIndex: sourceData.sources.map((s) => ({
      id: s.id,
      neighborhoodId: s.neighborhoodId,
      title: s.title,
      url: s.url,
    })),
    aiConfigured: Boolean(process.env.OPENAI_API_KEY?.trim()),
  });
});

app.post("/api/match", async (req, res) => {
  try {
    const description = String(req.body?.description ?? "");
    const result = await matchDescription(description, req.body);
    res.json(result);
  } catch (err) {
    const status = (err as { status?: number }).status ?? 500;
    res.status(status).json({
      error: err instanceof Error ? err.message : "Match failed.",
    });
  }
});

app.get("/api/events", async (req, res) => {
  try {
    const borough = parseBorough(req.query.borough);
    if (!borough) {
      res.status(400).json({
        error: "Choose one of the five NYC boroughs: Bronx, Brooklyn, Manhattan, Queens, or Staten Island.",
      });
      return;
    }
    const payload = await fetchPermittedEventRecords(borough);
    res.json(payload);
  } catch (err) {
    res.status(502).json({
      error:
        err instanceof Error
          ? `Could not load city records: ${err.message}`
          : "Could not load city records.",
      records: [],
    });
  }
});

function queryString(value: unknown): string | undefined {
  if (typeof value === "string") return value;
  if (Array.isArray(value) && typeof value[0] === "string") return value[0];
  return undefined;
}

app.get("/api/discover", async (req, res) => {
  try {
    const point = parseNycPoint(req.query.lat, req.query.lon);
    if (!point) {
      res.status(400).json({
        error: "Provide coordinates within New York City.",
      });
      return;
    }
    const boroughRaw = queryString(req.query.borough);
    let borough: NycBorough | undefined;
    if (boroughRaw != null && boroughRaw.trim() !== "") {
      const parsed = parseBorough(boroughRaw);
      if (!parsed) {
        res.status(400).json({
          error:
            "Choose one of the five NYC boroughs: Bronx, Brooklyn, Manhattan, Queens, or Staten Island.",
        });
        return;
      }
      borough = parsed;
    }
    const payload = await discoverNearbyArt(point.lat, point.lon, borough);
    res.json(payload);
  } catch (err) {
    console.error("Discovery feed failed:", err);
    res.status(502).json({
      error: "NYC place data is temporarily unavailable.",
      places: [],
    });
  }
});

app.get("/api/places", async (req, res) => {
  try {
    const point = parseNycPoint(req.query.lat, req.query.lon);
    if (!point) {
      res.status(400).json({
        error: "Provide coordinates within New York City.",
      });
      return;
    }
    const boroughRaw = queryString(req.query.borough);
    let borough: NycBorough | undefined;
    if (boroughRaw != null && boroughRaw.trim() !== "") {
      const parsed = parseBorough(boroughRaw);
      if (!parsed) {
        res.status(400).json({
          error:
            "Choose one of the five NYC boroughs: Bronx, Brooklyn, Manhattan, Queens, or Staten Island.",
        });
        return;
      }
      borough = parsed;
    }
    const interestsRaw = queryString(req.query.interests) ?? queryString(req.query.interest);
    const sentence = queryString(req.query.sentence) ?? "";
    const explicitInterests = parsePlaceInterests(interestsRaw);
    const payload = await recommendPlaces({
      lat: point.lat,
      lon: point.lon,
      borough,
      sentence,
      interests: explicitInterests.length ? explicitInterests : undefined,
      maxWalkMinutes: Number(queryString(req.query.maxWalkMinutes)),
      costFilter: queryString(req.query.cost),
    });
    res.json(payload);
  } catch (err) {
    console.error("Places feed failed:", err);
    res.status(502).json({
      error: "NYC Open Data place records are temporarily unavailable.",
      recommendations: [],
    });
  }
});

app.get("/api/citywide", async (req, res) => {
  try {
    const point = parseNycPoint(req.query.lat, req.query.lon);
    if (!point) {
      res.status(400).json({
        error: "Provide coordinates within New York City.",
      });
      return;
    }
    const boroughRaw = queryString(req.query.borough);
    let borough: NycBorough | undefined;
    if (boroughRaw != null && boroughRaw.trim() !== "") {
      const parsed = parseBorough(boroughRaw);
      if (!parsed) {
        res.status(400).json({
          error:
            "Choose one of the five NYC boroughs: Bronx, Brooklyn, Manhattan, Queens, or Staten Island.",
        });
        return;
      }
      borough = parsed;
    }
    const payload = await exploreCitywide({
      lat: point.lat,
      lon: point.lon,
      borough,
      interest: parseCitywideInterest(req.query.interest),
    });
    res.json(payload);
  } catch (err) {
    console.error("Citywide feed failed:", err);
    res.status(502).json({
      error: "NYC Open Data citywide records are temporarily unavailable.",
      results: [],
    });
  }
});

app.post("/api/ask", async (req, res) => {
  try {
    const neighborhoodId = String(req.body?.neighborhoodId ?? "");
    const question = String(req.body?.question ?? "");
    const result = await askNeighborhood(neighborhoodId, question);
    res.json(result);
  } catch (err) {
    const status = (err as { status?: number }).status ?? 500;
    res.status(status).json({
      error: err instanceof Error ? err.message : "Question failed.",
    });
  }
});

if (process.env.NODE_ENV === "production") {
  app.use(express.static(join(root, "dist")));
  app.get("*", (_req, res) => {
    res.sendFile(join(root, "dist", "index.html"));
  });
}

app.listen(port, () => {
  console.log(`Elsewhere, Here API on http://127.0.0.1:${port}`);
});
