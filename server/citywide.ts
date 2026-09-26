import type { NycBorough } from "./events.js";
import {
  parsePlaceInterests,
  recommendPlaces,
  type PlaceInterest,
  type PlacesPayload,
} from "./places.js";

export const CITYWIDE_INTERESTS = [
  "food",
  "markets",
  "gardens",
  "art",
  "history",
  "shops",
  "quiet",
] as const;

export type CitywideInterest = PlaceInterest;

/** Kept so older /api/citywide callers share /api/places ranking. */
export async function exploreCitywide(args: {
  lat: number;
  lon: number;
  borough?: NycBorough;
  interest: PlaceInterest;
}): Promise<PlacesPayload> {
  return recommendPlaces({
    lat: args.lat,
    lon: args.lon,
    borough: args.borough,
    interests: [args.interest],
  });
}

export function parseCitywideInterest(value: unknown): PlaceInterest {
  return parsePlaceInterests(value)[0] ?? "food";
}
