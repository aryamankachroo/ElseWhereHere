import { readFileSync } from "node:fs";
import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";
import { socrataJsonPaged } from "./opendata.js";
import { parseNycPoint } from "./discover.js";
import { parseBorough } from "./events.js";

export const SHOP_DATASET = "w7w3-xahh";
export const SHOP_SOURCE =
  "https://data.cityofnewyork.us/Business/Legally-Operating-Businesses/w7w3-xahh";

/** Visitor-facing storefront categories — not contractors, drivers, hotels, or generic electronics. */
export const SHOP_CATEGORIES = [
  "Newsstand",
  "Stoop Line Stand",
  "Secondhand Dealer - General",
] as const;

type CuratedShop = {
  id: string;
  title: string;
  borough: string;
  lat: number;
  lon: number;
  detail: string;
  sourceUrl: string;
  interestHints: string[];
};

function field(value: unknown): string {
  const text = String(value ?? "").trim();
  if (!text || text.toUpperCase() === "NULL") return "";
  return text;
}

export function nowInNewYork(now = new Date()): Date {
  const parts = new Intl.DateTimeFormat("en-US", {
    timeZone: "America/New_York",
    year: "numeric",
    month: "2-digit",
    day: "2-digit",
  }).formatToParts(now);
  const year = Number(parts.find((part) => part.type === "year")?.value);
  const month = Number(parts.find((part) => part.type === "month")?.value);
  const day = Number(parts.find((part) => part.type === "day")?.value);
  return new Date(Date.UTC(year, month - 1, day));
}

export function isLicenseCurrent(row: Record<string, unknown>, now = new Date()): boolean {
  const status = field(row.license_status).toLowerCase();
  if (status !== "active") return false;
  if (field(row.license_type).toLowerCase() !== "premises") return false;
  const expires = Date.parse(field(row.lic_expir_dd));
  if (!Number.isFinite(expires)) return false;
  return expires >= nowInNewYork(now).getTime();
}

export function shopPoint(row: Record<string, unknown>): { lat: number; lon: number } | null {
  const lat = Number(row.latitude);
  const lon = Number(row.longitude);
  if (!Number.isFinite(lat) || !Number.isFinite(lon) || (lat === 0 && lon === 0)) return null;
  return parseNycPoint(row.latitude, row.longitude);
}

export async function loadLicensedShopRows(): Promise<Record<string, unknown>[]> {
  const today = nowInNewYork().toISOString().slice(0, 10);
  const categories = SHOP_CATEGORIES.map((name) => `business_category='${name.replace(/'/g, "''")}'`).join(
    " or ",
  );
  return socrataJsonPaged(
    SHOP_DATASET,
    {
      $select:
        "license_nbr,business_name,business_category,license_type,license_status,lic_expir_dd,address_building,address_street_name,address_zip,address_borough,address_type,latitude,longitude",
      $where: [
        "license_status='Active'",
        "license_type='Premises'",
        `lic_expir_dd >= '${today}T00:00:00.000'`,
        "latitude is not null",
        "longitude is not null",
        `(${categories})`,
      ].join(" and "),
    },
    { pageSize: 1000, maxRows: 9000, timeoutMs: 18_000 },
  );
}

export function loadCuratedShopRecords(): CuratedShop[] {
  const path = join(dirname(fileURLToPath(import.meta.url)), "curated-shops.json");
  return JSON.parse(readFileSync(path, "utf8")) as CuratedShop[];
}

export function licensedShopSeed(row: Record<string, unknown>): {
  id: string;
  title: string;
  borough: string;
  lat: number;
  lon: number;
  categoryLabel: string;
  address: string;
  expires: string;
  licenseNbr: string;
} | null {
  if (!isLicenseCurrent(row)) return null;
  const point = shopPoint(row);
  const title = field(row.business_name);
  if (!point || !title) return null;
  return {
    id: field(row.license_nbr) || title,
    title,
    borough: parseBorough(field(row.address_borough)) ?? field(row.address_borough),
    lat: point.lat,
    lon: point.lon,
    categoryLabel: field(row.business_category),
    address: [field(row.address_building), field(row.address_street_name), field(row.address_zip)]
      .filter(Boolean)
      .join(" "),
    expires: field(row.lic_expir_dd).slice(0, 10),
    licenseNbr: field(row.license_nbr),
  };
}
