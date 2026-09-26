import { socrataJson } from "./opendata.js";

const EVENT_DATASET = "tvpp-9vvx";

export const NYC_BOROUGHS = [
  "Bronx",
  "Brooklyn",
  "Manhattan",
  "Queens",
  "Staten Island",
] as const;

export type NycBorough = (typeof NYC_BOROUGHS)[number];

export type PermittedEventRecord = {
  eventId: string;
  name: string;
  startDateTime: string;
  endDateTime: string | null;
  eventType: string | null;
  location: string | null;
  agency: string | null;
  borough: string;
};

export type EventsPayload = {
  label: string;
  disclaimer: string;
  borough: NycBorough;
  records: PermittedEventRecord[];
};

const BOROUGH_ALIASES: Record<string, NycBorough> = {
  bronx: "Bronx",
  brooklyn: "Brooklyn",
  manhattan: "Manhattan",
  queens: "Queens",
  "staten island": "Staten Island",
  statenisland: "Staten Island",
};

export function parseBorough(value: unknown): NycBorough | null {
  if (typeof value !== "string") return null;
  const key = value.trim().toLowerCase().replace(/_/g, " ");
  return BOROUGH_ALIASES[key] ?? null;
}

function isoForSoql(date: Date): string {
  return date.toISOString().replace(/\.\d{3}Z$/, "");
}

function asRecord(row: Record<string, unknown>): PermittedEventRecord | null {
  const name = String(row.event_name ?? "").trim();
  const start = String(row.start_date_time ?? "").trim();
  if (!name || !start) return null;
  return {
    eventId: String(row.event_id ?? `${name}-${start}`),
    name,
    startDateTime: start,
    endDateTime: row.end_date_time ? String(row.end_date_time) : null,
    eventType: row.event_type ? String(row.event_type) : null,
    location: row.event_location ? String(row.event_location) : null,
    agency: row.event_agency ? String(row.event_agency) : null,
    borough: String(row.event_borough ?? ""),
  };
}

export async function fetchPermittedEventRecords(
  borough: NycBorough,
  limit = 20,
): Promise<EventsPayload> {
  const now = new Date();
  const weekLater = new Date(now.getTime() + 7 * 24 * 60 * 60 * 1000);
  const start = isoForSoql(now);
  const end = isoForSoql(weekLater);
  const dateWhere = `start_date_time >= '${start}' AND start_date_time < '${end}'`;
  const where = `${dateWhere} AND upper(event_borough)='${borough.toUpperCase()}'`;

  let rows: Record<string, unknown>[];
  try {
    rows = await querySocrata(where, limit);
  } catch {
    rows = await querySocrata(dateWhere, Math.max(limit * 8, 80));
  }

  const records = rows
    .map(asRecord)
    .filter((row): row is PermittedEventRecord => row !== null)
    .filter((row) => row.borough.trim().toLowerCase() === borough.toLowerCase())
    .sort((a, b) => a.startDateTime.localeCompare(b.startDateTime))
    .slice(0, limit);

  return {
    label: `Upcoming permitted-event records in ${borough}`,
    disclaimer:
      "These are permitted-event records from NYC Open Data for the borough. They are not a confirmed list of live events, not specific to one neighborhood, and they are not used to calculate atmosphere scores.",
    borough,
    records,
  };
}

async function querySocrata(where: string, limit: number): Promise<Record<string, unknown>[]> {
  return socrataJson(
    EVENT_DATASET,
    {
      $select:
        "event_id,event_name,start_date_time,end_date_time,event_type,event_borough,event_location,event_agency",
      $where: where,
      $order: "start_date_time",
      $limit: String(limit),
    },
    10_000,
  );
}
