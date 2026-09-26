import { parseBorough, type NycBorough } from "./events.js";
import { socrataJsonPaged } from "./opendata.js";
import { distanceKm, parseNycPoint } from "./discover.js";
import {
  compareRanked,
  DEFAULT_MAX_WALK_MINUTES,
  parseCostFilter,
  parseHourRanges,
  parseListedDays,
  parseMaxWalkMinutes,
  parsePlaceSentence,
  scorePlaceRecord,
  type CostFilter,
  type CostStatus,
  type PlaceHours,
  type RequestedTime,
  type ScoreFactor,
  type OmittedFactor,
} from "./score.js";
import {
  RESTAURANT_DATASET,
  RESTAURANT_SOURCE,
  loadRestaurantInspectionsNear,
  restaurantHasDuplicateCamis,
  type RestaurantSeed,
} from "./restaurants.js";
import {
  SHOP_DATASET,
  SHOP_SOURCE,
  loadCuratedShopRecords,
  loadLicensedShopRows,
  licensedShopSeed,
} from "./shops.js";

/** Starting rank mix — change these numbers, not the scoring formula. */
export const RANK_WEIGHTS = {
  interest: 0.6,
  proximity: 0.3,
  detail: 0.1,
} as const;

/** Straight-line distance at which the proximity term reaches zero. */
export const PROXIMITY_KM = 8;
export const COMPLEMENT_KM = 1.6;
export const NEARBY_STOPS = 4;

const ART_DATASET = "2pg3-gcaa";
const MARKET_DATASET = "8vwk-6iz2";
const GARDEN_DATASET = "p78i-pat6";
const POPS_DATASET = "rvih-nhyn";
const CURATED_SHOPS_ID = "curated-shops";

const ART_SOURCE =
  "https://data.cityofnewyork.us/Housing-Development/Public-Design-Commission-Outdoor-Public-Art-Invent/2pg3-gcaa";
const MARKET_SOURCE = "https://data.cityofnewyork.us/dataset/NYC-Farmers-Markets/8vwk-6iz2";
const GARDEN_SOURCE = "https://data.cityofnewyork.us/Environment/GreenThumb-Garden-Info/p78i-pat6";
const POPS_SOURCE =
  "https://data.cityofnewyork.us/City-Government/Privately-Owned-Public-Spaces/rvih-nhyn";

const BOROUGH_FROM_CODE: Record<string, NycBorough> = {
  B: "Brooklyn",
  M: "Manhattan",
  Q: "Queens",
  X: "Bronx",
  R: "Staten Island",
};

export const PLACE_INTERESTS = [
  "food",
  "markets",
  "gardens",
  "art",
  "history",
  "shops",
  "quiet",
] as const;

export type PlaceInterest = (typeof PLACE_INTERESTS)[number];

const INTEREST_ALIASES: Record<string, PlaceInterest> = {
  food: "food",
  markets: "markets",
  gardens: "gardens",
  art: "art",
  arts: "art",
  history: "history",
  shops: "shops",
  smallshops: "shops",
  quiet: "quiet",
  greenery: "gardens",
  gathering: "quiet",
  energy: "food",
};

export type PlaceCategory =
  | "public-art"
  | "farmers-market"
  | "community-garden"
  | "public-space"
  | "restaurant"
  | "shop";

export type PlaceRecord = {
  id: string;
  title: string;
  category: PlaceCategory;
  borough: string;
  lat: number;
  lon: number;
  detail: string;
  sourceUrl: string;
  datasetId: string;
  hasSpecificDetail: boolean;
  cuisine?: string;
  interestHints?: PlaceInterest[];
  cost: CostStatus;
  hours: PlaceHours | null;
  tags: string[];
};

export type PlaceRecommendation = PlaceRecord & {
  distanceKm: number;
  matchedInterest: PlaceInterest | null;
  interestScore: number;
  proximityScore: number;
  detailScore: number;
  score: number;
  recommendationScore: number;
  estimatedWalkMinutes: number;
  walkLabel: string;
  hoursStatus: "matches" | "does_not_match" | "unknown";
  factors: ScoreFactor[];
  omittedFactors: OmittedFactor[];
  reason: string;
  whyItFits: string;
  excluded?: boolean;
};

export type PlaceSourceStatus = {
  datasetId: string;
  name: string;
  catalogUrl: string;
  available: boolean;
  recordCount: number;
  error?: string;
};

export type PlacesPayload = {
  label: string;
  disclaimer: string;
  borough: NycBorough | null;
  interests: PlaceInterest[];
  sentence: string;
  requestedTime: RequestedTime | null;
  costFilter: CostFilter;
  maxWalkMinutes: number;
  lat: number;
  lon: number;
  weights: { factor: string; weight: number }[];
  omittedFactors: OmittedFactor[];
  sources: PlaceSourceStatus[];
  primary: PlaceRecommendation | null;
  nearby: PlaceRecommendation[];
  recommendations: PlaceRecommendation[];
};

type DatasetCache = {
  expires: number;
  places: PlaceRecord[];
  error: string | null;
};

const CACHE_MS = 10 * 60 * 1000;
const datasetCache = new Map<string, DatasetCache>();

const INTEREST_LABEL: Record<PlaceInterest, string> = {
  food: "food",
  markets: "markets",
  gardens: "gardens",
  art: "art",
  history: "history",
  shops: "shops",
  quiet: "quiet spaces",
};

/**
 * How strongly each inventory category matches a tapped interest (0–1).
 * These are design weights, not taste, crowd, or authenticity scores.
 */
const AFFINITY: Record<PlaceInterest, Record<PlaceCategory, number>> = {
  food: {
    restaurant: 1,
    "farmers-market": 0.85,
    shop: 0.25,
    "community-garden": 0.2,
    "public-space": 0.1,
    "public-art": 0.05,
  },
  markets: {
    "farmers-market": 1,
    shop: 0.35,
    restaurant: 0.25,
    "community-garden": 0.15,
    "public-space": 0.1,
    "public-art": 0.05,
  },
  gardens: {
    "community-garden": 1,
    "public-space": 0.35,
    "farmers-market": 0.2,
    "public-art": 0.1,
    shop: 0.05,
    restaurant: 0.05,
  },
  art: {
    "public-art": 1,
    "public-space": 0.25,
    "community-garden": 0.15,
    "farmers-market": 0.1,
    shop: 0.1,
    restaurant: 0.05,
  },
  history: {
    "public-art": 1,
    shop: 0.35,
    "public-space": 0.3,
    "community-garden": 0.15,
    "farmers-market": 0.08,
    restaurant: 0.05,
  },
  shops: {
    shop: 1,
    "farmers-market": 0.45,
    restaurant: 0.15,
    "public-space": 0.1,
    "public-art": 0.08,
    "community-garden": 0.05,
  },
  quiet: {
    "community-garden": 1,
    "public-space": 0.9,
    "public-art": 0.4,
    shop: 0.1,
    "farmers-market": 0.08,
    restaurant: 0.05,
  },
};

const DATASETS: {
  id: string;
  name: string;
  catalogUrl: string;
  load: () => Promise<PlaceRecord[]>;
}[] = [
  { id: ART_DATASET, name: "Public Design Commission outdoor art", catalogUrl: ART_SOURCE, load: loadArt },
  { id: MARKET_DATASET, name: "NYC Farmers Markets", catalogUrl: MARKET_SOURCE, load: loadMarkets },
  { id: GARDEN_DATASET, name: "GreenThumb Garden Info", catalogUrl: GARDEN_SOURCE, load: loadGardens },
  {
    id: POPS_DATASET,
    name: "Privately Owned Public Spaces",
    catalogUrl: POPS_SOURCE,
    load: loadPops,
  },
  {
    id: SHOP_DATASET,
    name: "DCWP Issued Licenses (partial shop coverage)",
    catalogUrl: SHOP_SOURCE,
    load: loadShops,
  },
  {
    id: CURATED_SHOPS_ID,
    name: "Curated independent shops (gap fillers)",
    catalogUrl: SHOP_SOURCE,
    load: loadCuratedShops,
  },
];

function field(value: unknown): string {
  const text = String(value ?? "").trim();
  if (!text || text.toUpperCase() === "NULL") return "";
  return text;
}

function slug(parts: string[]): string {
  return parts
    .join("-")
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/^-|-$/g, "")
    .slice(0, 96);
}

function boroughName(raw: string, fallback?: NycBorough | null): string {
  const code = BOROUGH_FROM_CODE[raw.trim().toUpperCase()];
  if (code) return code;
  return parseBorough(raw) ?? fallback ?? field(raw);
}

function unknownAccess(tags: string[] = []): Pick<PlaceRecord, "cost" | "hours" | "tags"> {
  return { cost: "unknown", hours: null, tags };
}

function paidAccess(tags: string[] = []): Pick<PlaceRecord, "cost" | "hours" | "tags"> {
  return { cost: "paid", hours: null, tags };
}

function hoursForDays(
  source: PlaceHours["source"],
  days: number[] | null,
  raw: string,
): PlaceHours | null {
  const ranges = parseHourRanges(raw);
  if (!days?.length && ranges == null && !raw.trim()) return null;
  const byDay: PlaceHours["byDay"] = {};
  const applyDays = days?.length ? days : [0, 1, 2, 3, 4, 5, 6];
  for (const day of applyDays) {
    byDay[day] = { raw, ranges };
  }
  return { source, byDay };
}

function currentMarketYear(now = new Date()): number {
  return Number(
    new Intl.DateTimeFormat("en-US", { timeZone: "America/New_York", year: "numeric" }).format(now),
  );
}

export function parsePlaceInterests(value: unknown): PlaceInterest[] {
  const raw = Array.isArray(value)
    ? value.map((item) => String(item))
    : String(value ?? "")
        .split(",")
        .map((item) => item.trim());
  const picked: PlaceInterest[] = [];
  for (const item of raw) {
    const mapped = INTEREST_ALIASES[item.toLowerCase().replace(/_/g, "")];
    if (mapped && !picked.includes(mapped)) picked.push(mapped);
  }
  return picked;
}

function affinityFor(place: PlaceRecord, interest: PlaceInterest): number {
  let score = AFFINITY[interest][place.category];
  if (place.interestHints?.includes(interest)) score = Math.max(score, 0.9);
  if (interest === "food" && place.category === "restaurant" && place.cuisine) {
    score = Math.max(score, 1);
  }
  return score;
}

function bestInterestMatch(
  place: PlaceRecord,
  interests: PlaceInterest[],
): { interest: PlaceInterest; score: number } {
  let best: PlaceInterest = interests[0] ?? "food";
  let score = 0;
  for (const interest of interests) {
    const value = affinityFor(place, interest);
    if (value > score) {
      score = value;
      best = interest;
    }
  }
  return { interest: best, score };
}

function proximityScore(distanceKmValue: number): number {
  return Math.max(0, 1 - distanceKmValue / PROXIMITY_KM);
}

function dedupe(places: PlaceRecord[]): PlaceRecord[] {
  const seen = new Set<string>();
  const out: PlaceRecord[] = [];
  for (const place of places) {
    const key = `${place.category}|${place.title.toLowerCase()}|${place.lat.toFixed(4)}|${place.lon.toFixed(4)}`;
    if (seen.has(key) || seen.has(place.id)) continue;
    seen.add(key);
    seen.add(place.id);
    out.push(place);
  }
  return out;
}

async function cachedDataset(
  id: string,
  load: () => Promise<PlaceRecord[]>,
): Promise<{ places: PlaceRecord[]; error: string | null }> {
  const hit = datasetCache.get(id);
  if (hit && Date.now() <= hit.expires) {
    return { places: hit.places, error: hit.error };
  }
  try {
    const places = await load();
    datasetCache.set(id, { expires: Date.now() + CACHE_MS, places, error: null });
    return { places, error: null };
  } catch (err) {
    const error = err instanceof Error ? err.message : "Dataset request failed.";
    datasetCache.set(id, { expires: Date.now() + 2 * 60 * 1000, places: [], error });
    return { places: [], error };
  }
}

async function loadArt(): Promise<PlaceRecord[]> {
  const rows = await socrataJsonPaged(ART_DATASET, {
    $select: "title,location_name,address,latitude,longitude,artwork_type1,material,inscription,borough",
    $where:
      "latitude is not null and latitude != 'NULL' and longitude is not null and longitude != 'NULL'",
  });
  const places: PlaceRecord[] = [];
  for (const row of rows) {
    const point = parseNycPoint(row.latitude, row.longitude);
    const title = field(row.title);
    if (!point || !title) continue;
    const kind = field(row.artwork_type1) || "outdoor artwork";
    const whereText = field(row.location_name) || field(row.address);
    const material = field(row.material);
    const inscription = field(row.inscription);
    const bits = [
      `${kind}${whereText ? ` at ${whereText}` : ""}.`,
      material ? `Material listed: ${material}.` : "",
      inscription ? `Inscription in the inventory: ${inscription.slice(0, 180)}.` : "",
      "This is an inventory row, not a claim the work is on view today.",
    ].filter(Boolean);
    places.push({
      id: slug(["art", title, String(point.lat.toFixed(5)), String(point.lon.toFixed(5))]),
      title,
      category: "public-art",
      borough: boroughName(field(row.borough)),
      lat: point.lat,
      lon: point.lon,
      detail: bits.join(" "),
      sourceUrl: ART_SOURCE,
      datasetId: ART_DATASET,
      hasSpecificDetail: Boolean(material || inscription),
      interestHints: inscription ? ["history", "art"] : ["art"],
      ...unknownAccess([kind, material].filter(Boolean)),
    });
  }
  return places;
}

async function loadMarkets(): Promise<PlaceRecord[]> {
  const yearNow = currentMarketYear();
  const rows = await socrataJsonPaged(MARKET_DATASET, {
    $select:
      "year,marketname,borough,streetaddress,latitude,longitude,daysoperation,hoursoperations,open_year_round,season_begin",
    $where: `year >= ${yearNow} and latitude is not null and longitude is not null`,
  });
  const latest = new Map<string, Record<string, unknown>>();
  for (const row of rows) {
    const year = Number(row.year);
    if (!Number.isFinite(year) || year < yearNow) continue;
    const title = field(row.marketname);
    const point = parseNycPoint(row.latitude, row.longitude);
    if (!title || !point) continue;
    const key = `${title.toLowerCase()}|${point.lat.toFixed(4)}|${point.lon.toFixed(4)}`;
    const prev = latest.get(key);
    if (!prev || Number(prev.year) < year) latest.set(key, row);
  }

  const places: PlaceRecord[] = [];
  for (const row of latest.values()) {
    const point = parseNycPoint(row.latitude, row.longitude);
    const title = field(row.marketname);
    if (!point || !title) continue;
    const year = Number(row.year);
    const days = field(row.daysoperation);
    const hours = field(row.hoursoperations);
    const bits = [
      `Farmers market table for ${year} (older years are dropped).`,
      days ? `Listed days of operation: ${days}.` : "Days of operation are not listed.",
      hours
        ? `Hours copied from the table: ${hours}. That is not a live open-now check.`
        : "Hours are not published in this table, so this app does not say whether it is open.",
      field(row.open_year_round) ? `Open year-round (table): ${field(row.open_year_round)}.` : "",
      field(row.season_begin) ? `Season begin (table): ${field(row.season_begin)}.` : "",
      field(row.streetaddress) ? `Address: ${field(row.streetaddress)}.` : "",
    ].filter(Boolean);
    places.push({
      id: slug(["market", title, String(year), field(row.streetaddress)]),
      title,
      category: "farmers-market",
      borough: boroughName(field(row.borough)),
      lat: point.lat,
      lon: point.lon,
      detail: bits.join(" "),
      sourceUrl: MARKET_SOURCE,
      datasetId: MARKET_DATASET,
      hasSpecificDetail: Boolean(hours),
      ...unknownAccess([days, hours].filter(Boolean)),
      hours: parseListedDays(days)
        ? hoursForDays("market-listed", parseListedDays(days), hours)
        : null,
    });
  }
  return places;
}

const GARDEN_HOUR_FIELDS: [string, string, number][] = [
  ["Mon", "openhrsm", 1],
  ["Tue", "openhrstu", 2],
  ["Wed", "openhrsw", 3],
  ["Thu", "openhrsth", 4],
  ["Fri", "openhrsf", 5],
  ["Sat", "openhrssa", 6],
  ["Sun", "openhrssu", 0],
];

async function loadGardens(): Promise<PlaceRecord[]> {
  const rows = await socrataJsonPaged(GARDEN_DATASET, {
    $select:
      "parksid,gardenname,borough,address,nta,lat,lon,status,juris,openhrsm,openhrstu,openhrsw,openhrsth,openhrsf,openhrssa,openhrssu",
    $where: "status='Active' and lat is not null and lon is not null",
  });
  const places: PlaceRecord[] = [];
  for (const row of rows) {
    const point = parseNycPoint(row.lat, row.lon);
    const title = field(row.gardenname);
    if (!point || !title) continue;
    const hours = GARDEN_HOUR_FIELDS.map(([day, key]) => {
      const value = field(row[key]);
      return value ? `${day} ${value}` : "";
    }).filter(Boolean);
    const gardenHours: PlaceHours = { source: "garden-posted", byDay: {} };
    for (const [, key, weekday] of GARDEN_HOUR_FIELDS) {
      const value = field(row[key]);
      if (!value) continue;
      gardenHours.byDay[weekday] = { raw: value, ranges: parseHourRanges(value) };
    }
    const bits = [
      "Active GreenThumb garden (inactive and closed rows are excluded).",
      field(row.nta) ? `NTA listed: ${field(row.nta)}.` : "",
      field(row.address) ? `Address: ${field(row.address)}.` : "",
      field(row.juris) ? `Jurisdiction listed: ${field(row.juris)}.` : "",
      hours.length
        ? `Posted hours in the table: ${hours.join("; ")}. Copied text only — not a live open-now check.`
        : "No posted hours in this row, so this app does not say when you can enter.",
    ].filter(Boolean);
    places.push({
      id: slug(["garden", field(row.parksid) || title, String(point.lat.toFixed(5))]),
      title,
      category: "community-garden",
      borough: boroughName(field(row.borough)),
      lat: point.lat,
      lon: point.lon,
      detail: bits.join(" "),
      sourceUrl: GARDEN_SOURCE,
      datasetId: GARDEN_DATASET,
      hasSpecificDetail: hours.length > 0,
      ...unknownAccess(hours),
      hours: Object.keys(gardenHours.byDay).length ? gardenHours : null,
    });
  }
  return places;
}

async function loadPops(): Promise<PlaceRecord[]> {
  const rows = await socrataJsonPaged(POPS_DATASET, {
    $select:
      "pops_number,building_name,building_address_with_zip,address_number,street_name,borough_name,latitude,longitude,public_space_type,hour_of_access_required",
    $where:
      "latitude is not null and longitude is not null and hour_of_access_required is not null",
  });
  const places: PlaceRecord[] = [];
  for (const row of rows) {
    const point = parseNycPoint(row.latitude, row.longitude);
    const street = [field(row.address_number), field(row.street_name)].filter(Boolean).join(" ");
    const title =
      field(row.building_name) ||
      field(row.building_address_with_zip) ||
      street;
    const hours = field(row.hour_of_access_required);
    if (!point || !title || !hours) continue;
    const kind = field(row.public_space_type) || "privately owned public space";
    const bits = [
      `${kind}.`,
      `Required hours of public access in the table: ${hours}. That is a zoning listing, not a live open-now check.`,
      "Rows without listed access hours are excluded.",
    ];
    places.push({
      id: slug(["pops", field(row.pops_number) || title]),
      title,
      category: "public-space",
      borough: boroughName(field(row.borough_name)),
      lat: point.lat,
      lon: point.lon,
      detail: bits.join(" "),
      sourceUrl: POPS_SOURCE,
      datasetId: POPS_DATASET,
      hasSpecificDetail: Boolean(kind && field(row.public_space_type)),
      ...unknownAccess([kind, hours].filter(Boolean)),
      hours: hoursForDays("pops-required", [0, 1, 2, 3, 4, 5, 6], hours),
    });
  }
  return places;
}

async function loadShops(): Promise<PlaceRecord[]> {
  const rows = await loadLicensedShopRows();
  const places: PlaceRecord[] = [];
  for (const row of rows) {
    const seed = licensedShopSeed(row);
    if (!seed) continue;
    places.push({
      id: slug(["shop", seed.licenseNbr || seed.title]),
      title: seed.title,
      category: "shop",
      borough: seed.borough,
      lat: seed.lat,
      lon: seed.lon,
      detail: [
        "Partial coverage: DCWP Issued Licenses, not a directory of all stores.",
        `License category: ${seed.categoryLabel}.`,
        seed.address ? `Address: ${seed.address}.` : "",
        `Active premises license ${seed.licenseNbr}; listed expiration ${seed.expires}. Inactive, past-expiration, and non-premises licenses are excluded.`,
        "A license is not a popularity, hours, or authenticity rating.",
      ]
        .filter(Boolean)
        .join(" "),
      sourceUrl: SHOP_SOURCE,
      datasetId: SHOP_DATASET,
      hasSpecificDetail: Boolean(seed.categoryLabel && seed.expires),
      ...paidAccess([seed.categoryLabel]),
    });
  }
  return places;
}

async function loadCuratedShops(): Promise<PlaceRecord[]> {
  const places: PlaceRecord[] = [];
  for (const row of loadCuratedShopRecords()) {
    const point = parseNycPoint(row.lat, row.lon);
    if (!point) continue;
    const hints = row.interestHints.filter((item): item is PlaceInterest =>
      (PLACE_INTERESTS as readonly string[]).includes(item),
    );
    places.push({
      id: slug(["curated", row.id]),
      title: row.title,
      category: "shop",
      borough: row.borough,
      lat: point.lat,
      lon: point.lon,
      detail: `${row.detail} Curated gap filler with its own source link.`,
      sourceUrl: row.sourceUrl,
      datasetId: CURATED_SHOPS_ID,
      hasSpecificDetail: true,
      interestHints: hints,
      ...paidAccess(hints),
    });
  }
  return places;
}

function restaurantsToPlaces(seeds: RestaurantSeed[]): PlaceRecord[] {
  return seeds.map((seed) => ({
    id: slug(["restaurant", seed.camis]),
    title: seed.title,
    category: "restaurant" as const,
    borough: seed.borough,
    lat: seed.lat,
    lon: seed.lon,
    cuisine: seed.cuisine || undefined,
    detail: [
      "DOHMH restaurant inspection record (deduplicated by CAMIS; latest inspection details kept).",
      seed.cuisine
        ? `Cuisine listed: ${seed.cuisine}. Cuisine is an interest signal only — not authenticity or taste.`
        : "Cuisine is not listed on the latest usable inspection row.",
      seed.address ? `Inspection address: ${seed.address}.` : "",
      seed.inspectionDate ? `Latest inspection date in this extract: ${seed.inspectionDate}.` : "",
      "Coordinates are the department’s geocode of that address (location / lat-lon fields). Rows without a valid NYC point are omitted from distance ranking. This app does not geocode the address itself.",
      "Inspection letters from this table are unused and are not taste or quality ratings. This is not an open-now check.",
    ]
      .filter(Boolean)
      .join(" "),
    sourceUrl: RESTAURANT_SOURCE,
    datasetId: RESTAURANT_DATASET,
    hasSpecificDetail: Boolean(seed.cuisine),
    ...paidAccess(seed.cuisine ? [seed.cuisine] : []),
  }));
}

function scorePlace(
  place: PlaceRecord,
  originLat: number,
  originLon: number,
  query: {
    interests: PlaceInterest[];
    maxWalkMinutes: number;
    costFilter: CostFilter;
    requestedTime: RequestedTime | null;
  },
): PlaceRecommendation {
  const ranked = scorePlaceRecord(place, {
    lat: originLat,
    lon: originLon,
    interests: query.interests,
    maxWalkMinutes: query.maxWalkMinutes,
    costFilter: query.costFilter,
    requestedTime: query.requestedTime,
  });
  const distance = Math.round(distanceKm(originLat, originLon, place.lat, place.lon) * 100) / 100;
  const interestFactor = ranked.factors.find((factor) => factor.id === "interest");
  const proximityFactor = ranked.factors.find((factor) => factor.id === "proximity");
  const matchedInterest = query.interests.length
    ? bestInterestMatch(place, query.interests).interest
    : null;
  const reason = ranked.excluded
    ? ranked.excludeReason ?? "Excluded by a stated free-only request."
    : ranked.factors
        .map(
          (factor) =>
            `${factor.label}: ${Math.round(factor.value * 100)} × ${factor.weight} — ${factor.evidence}`,
        )
        .join(" ");
  const whyItFits = ranked.excluded
    ? ranked.excludeReason ?? "Excluded."
    : `Recommendation score ${ranked.recommendationScore} (0–100) from a weighted average of only the listed factors. ${ranked.walkLabel} This is not a safety, authenticity, or official NYC rating.`;

  return {
    ...place,
    distanceKm: distance,
    matchedInterest,
    interestScore: interestFactor?.value ?? 0,
    proximityScore: proximityFactor?.value ?? 0,
    detailScore: place.hasSpecificDetail ? 1 : 0,
    score: ranked.recommendationScore,
    recommendationScore: ranked.recommendationScore,
    estimatedWalkMinutes: ranked.estimatedWalkMinutes,
    walkLabel: ranked.walkLabel,
    hoursStatus: ranked.hoursStatus,
    factors: ranked.factors,
    omittedFactors: ranked.omittedFactors,
    reason,
    whyItFits,
    excluded: ranked.excluded,
  };
}

export function pickPrimaryAndNearby(ranked: PlaceRecommendation[]): {
  primary: PlaceRecommendation | null;
  nearby: PlaceRecommendation[];
} {
  const primary = ranked[0] ?? null;
  if (!primary) return { primary: null, nearby: [] };
  const nearby: PlaceRecommendation[] = [];
  const usedCategories = new Set<PlaceCategory>([primary.category]);
  const pool = ranked
    .filter((place) => place.id !== primary.id)
    .sort((a, b) => a.distanceKm - b.distanceKm || b.score - a.score);
  for (const place of pool) {
    if (nearby.length >= NEARBY_STOPS) break;
    if (place.distanceKm > COMPLEMENT_KM * 2) continue;
    if (usedCategories.has(place.category)) continue;
    nearby.push(place);
    usedCategories.add(place.category);
  }
  if (nearby.length < NEARBY_STOPS) {
    for (const place of pool) {
      if (nearby.length >= NEARBY_STOPS) break;
      if (nearby.some((item) => item.id === place.id) || place.id === primary.id) continue;
      nearby.push(place);
    }
  }
  return { primary, nearby };
}

export async function recommendPlaces(args: {
  lat: number;
  lon: number;
  borough?: NycBorough;
  interests?: PlaceInterest[];
  sentence?: string;
  maxWalkMinutes?: unknown;
  costFilter?: unknown;
  now?: Date;
}): Promise<PlacesPayload> {
  const { lat, lon, borough } = args;
  const parsed = parsePlaceSentence(args.sentence ?? "", args.now);
  const interests = args.interests?.length ? args.interests : parsed.interests;
  const costFilter =
    args.costFilter != null && String(args.costFilter).trim() !== ""
      ? parseCostFilter(args.costFilter)
      : parsed.costFilter;
  const maxWalkMinutes = parseMaxWalkMinutes(args.maxWalkMinutes, DEFAULT_MAX_WALK_MINUTES);
  const requestedTime = parsed.requestedTime;

  const restaurantKey = `rest:${lat.toFixed(3)}:${lon.toFixed(3)}:${borough ?? "all"}`;
  const settled = await Promise.all([
    ...DATASETS.map(async (dataset) => {
      const result = await cachedDataset(dataset.id, dataset.load);
      return { dataset, ...result };
    }),
    cachedDataset(restaurantKey, async () => {
      const seeds = await loadRestaurantInspectionsNear(lat, lon, borough);
      if (restaurantHasDuplicateCamis(seeds)) {
        throw new Error("Restaurant CAMIS dedupe failed.");
      }
      return restaurantsToPlaces(seeds);
    }).then((result) => ({
      dataset: {
        id: RESTAURANT_DATASET,
        name: "DOHMH restaurant inspection results",
        catalogUrl: RESTAURANT_SOURCE,
        load: async () => [] as PlaceRecord[],
      },
      ...result,
    })),
  ]);

  const sources: PlaceSourceStatus[] = settled.map(({ dataset, places, error }) => ({
    datasetId: dataset.id,
    name: dataset.name,
    catalogUrl: dataset.catalogUrl,
    available: !error,
    recordCount: places.length,
    ...(error ? { error } : {}),
  }));

  const collected: PlaceRecord[] = [];
  for (const item of settled) {
    if (!item.error) collected.push(...item.places);
  }

  const ranked = dedupe(collected)
    .filter((place) => (borough ? place.borough === borough : true))
    .map((place) =>
      scorePlace(place, lat, lon, {
        interests,
        maxWalkMinutes,
        costFilter,
        requestedTime,
      }),
    )
    .filter((place) => !place.excluded)
    .sort(compareRanked);

  const { primary, nearby } = pickPrimaryAndNearby(ranked);
  const recommendations = primary ? [primary, ...nearby] : [];
  const unavailable = sources.filter((source) => !source.available).map((source) => source.name);

  return {
    label: borough
      ? `Citywide inventory rows in ${borough}`
      : "Citywide inventory rows near this point",
    disclaimer: [
      "Recommendation scores are a weighted average of only evidence-backed factors (0–100). They are not safety, authenticity, or official NYC ratings.",
      "Walking time is a straight-line estimate (meters ÷ 80), not a verified route or an actual 15-minute walk.",
      "Missing cost or hours stays unknown. Unknown records are not excluded. Free-only excludes places verified as paid (restaurants and licensed shops).",
      "Shade, cleanliness, and “local” are omitted — those fields are not in the loaded tables.",
      unavailable.length ? `Unavailable right now: ${unavailable.join("; ")}.` : "",
    ]
      .filter(Boolean)
      .join(" "),
    borough: borough ?? null,
    interests,
    sentence: parsed.sentence,
    requestedTime,
    costFilter,
    maxWalkMinutes,
    lat,
    lon,
    weights: primary?.factors.map((factor) => ({ factor: factor.id, weight: factor.weight })) ?? [
      { factor: "proximity", weight: 0.5 },
    ],
    omittedFactors: primary?.omittedFactors ?? [],
    sources,
    primary,
    nearby,
    recommendations,
  };
}

export { restaurantHasDuplicateCamis };
