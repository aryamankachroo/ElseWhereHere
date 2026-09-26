import { type NycBorough } from "./events.js";
import { socrataJson } from "./opendata.js";

/** SODA JSON endpoint for dataset 2pg3-gcaa (query this). */
const ART_API = "https://data.cityofnewyork.us/resource/2pg3-gcaa.json";
/** Catalog page for the same dataset (cite this; do not fetch HTML). */
const ART_SOURCE =
  "https://data.cityofnewyork.us/Housing-Development/Public-Design-Commission-Outdoor-Public-Art-Invent/2pg3-gcaa";
const ART_DATASET = "2pg3-gcaa";

const ART_SELECT =
  "title,location_name,address,latitude,longitude,material,artwork_type1,inscription,borough";

const NYC_BOUNDS = {
  latMin: 40.45,
  latMax: 40.95,
  lonMin: -74.3,
  lonMax: -73.65,
};

const NEARBY_KM = 5;

export type DiscoverPlace = {
  title: string;
  location: string;
  material: string;
  kind: string;
  inscription: string;
  lat: number;
  lon: number;
  distanceKm: number;
  borough: string;
  source: string;
};

export type DiscoverPayload = {
  label: string;
  disclaimer: string;
  lat: number;
  lon: number;
  places: DiscoverPlace[];
  resource: string;
};

type ArtCache = { rows: Record<string, unknown>[]; expires: number };

const artCache = new Map<string, ArtCache>();

export function parseNycPoint(latRaw: unknown, lonRaw: unknown): { lat: number; lon: number } | null {
  const lat = Number(latRaw);
  const lon = Number(lonRaw);
  if (
    !Number.isFinite(lat) ||
    !Number.isFinite(lon) ||
    lat < NYC_BOUNDS.latMin ||
    lat > NYC_BOUNDS.latMax ||
    lon < NYC_BOUNDS.lonMin ||
    lon > NYC_BOUNDS.lonMax
  ) {
    return null;
  }
  return { lat, lon };
}

export function distanceKm(lat1: number, lon1: number, lat2: number, lon2: number): number {
  const rad = Math.PI / 180;
  const dLat = (lat2 - lat1) * rad;
  const dLon = (lon2 - lon1) * rad;
  const a =
    Math.sin(dLat / 2) ** 2 +
    Math.cos(lat1 * rad) * Math.cos(lat2 * rad) * Math.sin(dLon / 2) ** 2;
  return 6371 * 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1 - a));
}

function geocodeWhere(borough?: string): string {
  const geo =
    "latitude is not null and latitude != 'NULL' and longitude is not null and longitude != 'NULL'";
  if (!borough) return geo;
  const escaped = borough.replace(/'/g, "''");
  return `${geo} and upper(borough)='${escaped.toUpperCase()}'`;
}

async function loadArtInventory(borough?: string): Promise<Record<string, unknown>[]> {
  const key = borough ?? "all";
  const hit = artCache.get(key);
  if (hit && Date.now() <= hit.expires) return hit.rows;

  const rows = await socrataJson(ART_DATASET, {
    $select: ART_SELECT,
    $where: geocodeWhere(borough),
    $limit: "1000",
  });

  artCache.set(key, { rows, expires: Date.now() + 10 * 60 * 1000 });
  return rows;
}

function field(value: unknown): string {
  const text = String(value ?? "").trim();
  if (!text || text.toUpperCase() === "NULL") return "";
  return text;
}

function asPlace(
  row: Record<string, unknown>,
  originLat: number,
  originLon: number,
): DiscoverPlace | null {
  const placeLat = Number(row.latitude);
  const placeLon = Number(row.longitude);
  if (!Number.isFinite(placeLat) || !Number.isFinite(placeLon)) return null;
  const title = field(row.title);
  if (!title) return null;
  return {
    title,
    location: field(row.location_name) || field(row.address) || "NYC",
    material: field(row.material),
    kind: field(row.artwork_type1) || "Public artwork",
    inscription: field(row.inscription),
    lat: placeLat,
    lon: placeLon,
    distanceKm: distanceKm(originLat, originLon, placeLat, placeLon),
    borough: field(row.borough),
    source: ART_SOURCE,
  };
}

export async function discoverNearbyArt(
  lat: number,
  lon: number,
  borough?: NycBorough,
): Promise<DiscoverPayload> {
  const rows = await loadArtInventory(borough);
  const places = rows
    .map((row) => asPlace(row, lat, lon))
    .filter((place): place is DiscoverPlace => place !== null && place.distanceKm <= NEARBY_KM)
    .sort((a, b) => a.distanceKm - b.distanceKm)
    .slice(0, 8);

  return {
    label: borough
      ? `Outdoor public-art inventory in ${borough} within ${NEARBY_KM} km`
      : `Outdoor public-art inventory records within ${NEARBY_KM} km`,
    disclaimer:
      "These rows come from the Public Design Commission inventory on NYC Open Data (2pg3-gcaa). Latitude and longitude are text fields, so nearby is computed here after a SoQL $select/$where — not from a live ranked attractions list.",
    lat,
    lon,
    places,
    resource: ART_API,
  };
}
