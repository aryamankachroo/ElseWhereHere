import type { PlaceInterest } from "./types";

export const PLACE_INTERESTS: { id: PlaceInterest; label: string }[] = [
  { id: "food", label: "Food" },
  { id: "markets", label: "Markets" },
  { id: "gardens", label: "Gardens" },
  { id: "art", label: "Art" },
  { id: "history", label: "History" },
  { id: "shops", label: "Shops" },
  { id: "quiet", label: "Quiet spaces" },
];

export const NYC_BOROUGHS = [
  "Bronx",
  "Brooklyn",
  "Manhattan",
  "Queens",
  "Staten Island",
] as const;

export type NycBoroughName = (typeof NYC_BOROUGHS)[number];

export const BOROUGH_POINT: Record<NycBoroughName, { lat: number; lon: number }> = {
  Bronx: { lat: 40.8448, lon: -73.8648 },
  Brooklyn: { lat: 40.678, lon: -73.944 },
  Manhattan: { lat: 40.7831, lon: -73.9712 },
  Queens: { lat: 40.7553, lon: -73.883 },
  "Staten Island": { lat: 40.5795, lon: -74.1502 },
};

export const CATEGORY_LABEL: Record<
  | "public-art"
  | "farmers-market"
  | "community-garden"
  | "public-space"
  | "restaurant"
  | "shop",
  string
> = {
  "public-art": "Public-art inventory",
  "farmers-market": "Farmers market table",
  "community-garden": "GreenThumb garden",
  "public-space": "Privately owned public space",
  restaurant: "Restaurant inspection record",
  shop: "Shop (partial coverage)",
};
