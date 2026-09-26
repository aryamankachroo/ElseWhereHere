import { socrataJsonPaged } from "./opendata.js";
import { parseNycPoint } from "./discover.js";
import { type NycBorough, parseBorough } from "./events.js";

export const RESTAURANT_DATASET = "43nn-pn8j";
export const RESTAURANT_SOURCE =
  "https://data.cityofnewyork.us/Health/DOHMH-New-York-City-Restaurant-Inspection-Results/43nn-pn8j";

const SEARCH_RADIUS_M = 4500;
const INSPECTION_ROW_CAP = 2500;

export type RestaurantSeed = {
  camis: string;
  title: string;
  borough: string;
  lat: number;
  lon: number;
  cuisine: string;
  address: string;
  inspectionDate: string;
};

function field(value: unknown): string {
  const text = String(value ?? "").trim();
  if (!text || text.toUpperCase() === "NULL") return "";
  return text;
}

function inspectionTime(value: unknown): number {
  const text = field(value);
  if (!text || text.startsWith("1900-01-01")) return 0;
  const ms = Date.parse(text);
  return Number.isFinite(ms) ? ms : 0;
}

/** Official DOHMH geocode of the inspection address — never a live GPS ping. */
export function restaurantPoint(row: Record<string, unknown>): { lat: number; lon: number } | null {
  const location = row.location;
  if (location && typeof location === "object") {
    const coordinates = (location as { coordinates?: unknown }).coordinates;
    if (Array.isArray(coordinates) && coordinates.length >= 2) {
      const fromLocation = parseNycPoint(coordinates[1], coordinates[0]);
      if (fromLocation) return fromLocation;
    }
  }
  const lat = Number(row.latitude);
  const lon = Number(row.longitude);
  if (!Number.isFinite(lat) || !Number.isFinite(lon) || (lat === 0 && lon === 0)) return null;
  return parseNycPoint(row.latitude, row.longitude);
}

export function mergeRestaurantRow(
  current: Record<string, unknown> | undefined,
  incoming: Record<string, unknown>,
): Record<string, unknown> {
  if (!current) return { ...incoming };
  const newer = inspectionTime(incoming.inspection_date) > inspectionTime(current.inspection_date);
  const base = newer ? { ...incoming } : { ...current };
  const other = newer ? current : incoming;
  if (!field(base.cuisine_description) && field(other.cuisine_description)) {
    base.cuisine_description = other.cuisine_description;
  }
  if (!field(base.dba) && field(other.dba)) base.dba = other.dba;
  return base;
}

export function dedupeInspectionsByCamis(rows: Record<string, unknown>[]): RestaurantSeed[] {
  const byCamis = new Map<string, Record<string, unknown>>();
  for (const row of rows) {
    const camis = field(row.camis);
    if (!camis) continue;
    if (inspectionTime(row.inspection_date) <= 0) continue;
    const point = restaurantPoint(row);
    if (!point) continue;
    byCamis.set(camis, mergeRestaurantRow(byCamis.get(camis), row));
  }

  const out: RestaurantSeed[] = [];
  for (const [camis, row] of byCamis) {
    const point = restaurantPoint(row);
    const title = field(row.dba);
    if (!point || !title) continue;
    const borough = parseBorough(field(row.boro)) ?? field(row.boro);
    const address = [field(row.building), field(row.street), field(row.zipcode)].filter(Boolean).join(" ");
    out.push({
      camis,
      title,
      borough,
      lat: point.lat,
      lon: point.lon,
      cuisine: field(row.cuisine_description),
      address,
      inspectionDate: field(row.inspection_date).slice(0, 10),
    });
  }
  return out;
}

export function restaurantHasDuplicateCamis(seeds: RestaurantSeed[]): boolean {
  const seen = new Set<string>();
  for (const seed of seeds) {
    if (seen.has(seed.camis)) return true;
    seen.add(seed.camis);
  }
  return false;
}

export async function loadRestaurantInspectionsNear(
  lat: number,
  lon: number,
  borough?: NycBorough,
): Promise<RestaurantSeed[]> {
  const since = new Date();
  since.setFullYear(since.getFullYear() - 2);
  const sinceIso = since.toISOString().replace(/\.\d{3}Z$/, "");
  const parts = [
    `within_circle(location,${lat},${lon},${SEARCH_RADIUS_M})`,
    `inspection_date > '${sinceIso}'`,
    "latitude is not null",
    "longitude is not null",
    "latitude != '0'",
    "longitude != '0'",
    "dba is not null",
  ];
  if (borough) parts.push(`upper(boro)='${borough.toUpperCase()}'`);

  const rows = await socrataJsonPaged(
    RESTAURANT_DATASET,
    {
      $select:
        "camis,dba,boro,building,street,zipcode,latitude,longitude,location,cuisine_description,inspection_date",
      $where: parts.join(" and "),
      $order: "inspection_date DESC",
    },
    { pageSize: 1000, maxRows: INSPECTION_ROW_CAP, timeoutMs: 18_000 },
  );

  return dedupeInspectionsByCamis(rows);
}
