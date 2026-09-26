import { distanceKm } from "./discover.js";

export type PlaceInterest =
  | "food"
  | "markets"
  | "gardens"
  | "art"
  | "history"
  | "shops"
  | "quiet";

/** Straight-line meters per estimated walking minute. Not a routed walk. */
export const WALK_METERS_PER_MINUTE = 80;
export const DEFAULT_MAX_WALK_MINUTES = 20;
export const MIN_WALK_MINUTES = 5;
export const MAX_WALK_MINUTES = 90;

export const FACTOR_IDS = [
  "proximity",
  "interest",
  "cost",
  "hours",
  "shade",
  "clean",
  "local",
] as const;

export type FactorId = (typeof FACTOR_IDS)[number];
export type CostStatus = "paid" | "unknown";
export type CostFilter = "any" | "free";

export type DayHours = {
  raw: string;
  ranges: { startMin: number; endMin: number }[] | null;
};

export type PlaceHours = {
  source: "garden-posted" | "market-listed" | "pops-required";
  byDay: Partial<Record<number, DayHours>>;
};

export type RequestedTime = {
  label: string;
  days: number[];
  startMin: number;
  endMin: number;
};

export type SentenceQuery = {
  sentence: string;
  interests: PlaceInterest[];
  costFilter: CostFilter;
  requestedTime: RequestedTime | null;
  nearbyMentioned: boolean;
};

export type ScoreFactor = {
  id: FactorId;
  label: string;
  value: number;
  weight: number;
  evidence: string;
};

export type OmittedFactor = {
  id: FactorId;
  reason: string;
};

export type ScoreablePlace = {
  id: string;
  title: string;
  category: string;
  lat: number;
  lon: number;
  cost: CostStatus;
  hours: PlaceHours | null;
  tags: string[];
  interestHints?: PlaceInterest[];
};

export type RankedScore = {
  recommendationScore: number;
  estimatedWalkMinutes: number;
  distanceMeters: number;
  walkLabel: string;
  factors: ScoreFactor[];
  omittedFactors: OmittedFactor[];
  hoursStatus: "matches" | "does_not_match" | "unknown";
  excluded: boolean;
  excludeReason?: string;
};

const INTEREST_PHRASES: { phrase: string; interest: PlaceInterest }[] = [
  { phrase: "farmers market", interest: "markets" },
  { phrase: "farmer's market", interest: "markets" },
  { phrase: "community garden", interest: "gardens" },
  { phrase: "public art", interest: "art" },
  { phrase: "quiet space", interest: "quiet" },
  { phrase: "quiet spaces", interest: "quiet" },
  { phrase: "gardens", interest: "gardens" },
  { phrase: "garden", interest: "gardens" },
  { phrase: "greenery", interest: "gardens" },
  { phrase: "markets", interest: "markets" },
  { phrase: "market", interest: "markets" },
  { phrase: "restaurants", interest: "food" },
  { phrase: "restaurant", interest: "food" },
  { phrase: "food", interest: "food" },
  { phrase: "kitchen", interest: "food" },
  { phrase: "history", interest: "history" },
  { phrase: "historic", interest: "history" },
  { phrase: "shops", interest: "shops" },
  { phrase: "shop", interest: "shops" },
  { phrase: "store", interest: "shops" },
  { phrase: "artwork", interest: "art" },
  { phrase: "art", interest: "art" },
  { phrase: "quiet", interest: "quiet" },
];

const WEEKDAY_INDEX: Record<string, number> = {
  sunday: 0,
  sun: 0,
  monday: 1,
  mon: 1,
  tuesday: 2,
  tue: 2,
  tues: 2,
  wednesday: 3,
  wed: 3,
  thursday: 4,
  thu: 4,
  thur: 4,
  thurs: 4,
  friday: 5,
  fri: 5,
  saturday: 6,
  sat: 6,
};

const ALWAYS_OMITTED: OmittedFactor[] = [
  {
    id: "shade",
    reason: "No shade, canopy, or tree-cover field exists in the loaded Open Data tables.",
  },
  {
    id: "clean",
    reason: "No cleanliness or air-quality field is used. An air-quality measure is not called “clean.”",
  },
  {
    id: "local",
    reason: "No source documents whether a place is “local” or independently owned.",
  },
];

export function hasPhrase(text: string, phrase: string): boolean {
  const escaped = phrase
    .trim()
    .replace(/[.*+?^${}()|[\]\\]/g, "\\$&")
    .replace(/\s+/g, "\\s+");
  if (!escaped) return false;
  return new RegExp(`\\b${escaped}\\b`, "i").test(text);
}

export function clamp(value: number, min: number, max: number): number {
  if (!Number.isFinite(value)) return min;
  return Math.min(max, Math.max(min, value));
}

export function parseMaxWalkMinutes(value: unknown, fallback = DEFAULT_MAX_WALK_MINUTES): number {
  const n = typeof value === "number" ? value : Number(String(value ?? "").trim());
  if (!Number.isFinite(n)) return fallback;
  return Math.round(clamp(n, MIN_WALK_MINUTES, MAX_WALK_MINUTES));
}

export function parseCostFilter(value: unknown): CostFilter {
  const raw = String(value ?? "").trim().toLowerCase();
  if (raw === "free" || raw === "free-only" || raw === "freeonly") return "free";
  return "any";
}

export function nyParts(now: Date): {
  year: number;
  month: number;
  day: number;
  hour: number;
  minute: number;
  weekday: number;
} {
  const parts = new Intl.DateTimeFormat("en-US", {
    timeZone: "America/New_York",
    weekday: "short",
    year: "numeric",
    month: "2-digit",
    day: "2-digit",
    hour: "2-digit",
    minute: "2-digit",
    hourCycle: "h23",
  }).formatToParts(now);
  const read = (type: string) => parts.find((part) => part.type === type)?.value ?? "";
  const weekdayName = read("weekday").toLowerCase();
  const weekdayMap: Record<string, number> = {
    sun: 0,
    mon: 1,
    tue: 2,
    wed: 3,
    thu: 4,
    fri: 5,
    sat: 6,
  };
  return {
    year: Number(read("year")),
    month: Number(read("month")),
    day: Number(read("day")),
    hour: Number(read("hour")),
    minute: Number(read("minute")),
    weekday: weekdayMap[weekdayName] ?? 0,
  };
}

export function parseClockToMinutes(raw: string): number | null {
  const text = raw.trim().toLowerCase().replace(/\s+/g, "");
  if (!text) return null;
  const match = text.match(/^(\d{1,2})(?::(\d{2}))?(am|pm)?$/);
  if (!match) return null;
  let hour = Number(match[1]);
  const minute = Number(match[2] ?? 0);
  const mer = match[3];
  if (!Number.isFinite(hour) || !Number.isFinite(minute) || minute > 59) return null;
  if (mer === "am") {
    if (hour === 12) hour = 0;
  } else if (mer === "pm") {
    if (hour < 12) hour += 12;
  } else if (hour > 23) {
    return null;
  }
  if (hour > 23) return null;
  return hour * 60 + minute;
}

export function parseHourRanges(raw: string): { startMin: number; endMin: number }[] | null {
  const text = fieldText(raw);
  if (!text) return null;
  const lower = text.toLowerCase();
  if (/\bclosed\b/.test(lower)) return [];
  if (/\b24\s*(hours|hrs|hr)\b/.test(lower) || lower === "24/7" || lower === "24 hours") {
    return [{ startMin: 0, endMin: 1440 }];
  }
  if (/\bdawn\b/.test(lower) || /\bdusk\b/.test(lower)) return null;

  const cleaned = text
    .replace(/[–—]/g, "-")
    .replace(/\s+to\s+/gi, "-")
    .replace(/\s+/g, " ")
    .trim();
  const parts = cleaned.split(/,|;/).map((part) => part.trim()).filter(Boolean);
  const ranges: { startMin: number; endMin: number }[] = [];
  for (const part of parts) {
    const pair = part.match(
      /(\d{1,2}(?::\d{2})?\s*(?:am|pm)?)\s*-\s*(\d{1,2}(?::\d{2})?\s*(?:am|pm)?)/i,
    );
    if (!pair) continue;
    const start = parseClockToMinutes(pair[1]);
    const end = parseClockToMinutes(pair[2]);
    if (start == null || end == null) continue;
    ranges.push({ startMin: start, endMin: end <= start ? end + 1440 : end });
  }
  return ranges.length ? ranges : null;
}

export function parseListedDays(raw: string): number[] | null {
  const text = fieldText(raw).toLowerCase();
  if (!text) return null;
  if (hasPhrase(text, "weekend") || hasPhrase(text, "weekends")) return [0, 6];
  const days: number[] = [];
  for (const [name, index] of Object.entries(WEEKDAY_INDEX)) {
    if (hasPhrase(text, name) && !days.includes(index)) days.push(index);
  }
  return days.length ? days : null;
}

export function parseWindow(text: string, now = new Date()): RequestedTime | null {
  const source = text.trim();
  if (!source) return null;
  const ny = nyParts(now);
  const nowMin = ny.hour * 60 + ny.minute;

  if (hasPhrase(source, "tonight")) {
    if (nowMin >= 22 * 60) {
      return {
        label: "tonight (remaining hours after 10 p.m. Eastern)",
        days: [ny.weekday],
        startMin: nowMin,
        endMin: 26 * 60,
      };
    }
    return {
      label: "tonight (evening in America/New_York)",
      days: [ny.weekday],
      startMin: Math.max(nowMin, 17 * 60),
      endMin: 24 * 60,
    };
  }

  if (hasPhrase(source, "weekend") || hasPhrase(source, "weekends")) {
    const days = ny.weekday === 0 ? [6, 0] : ny.weekday === 6 ? [6, 0] : [6, 0];
    return {
      label: "this weekend (Saturday and Sunday, America/New_York)",
      days,
      startMin: 0,
      endMin: 1440,
    };
  }

  for (const [name, index] of Object.entries(WEEKDAY_INDEX)) {
    if (name.length < 3) continue;
    if (hasPhrase(source, name)) {
      return {
        label: `${name[0].toUpperCase()}${name.slice(1)} (America/New_York)`,
        days: [index],
        startMin: 0,
        endMin: 1440,
      };
    }
  }

  if (hasPhrase(source, "today")) {
    return {
      label: "today (America/New_York)",
      days: [ny.weekday],
      startMin: nowMin,
      endMin: 1440,
    };
  }

  if (hasPhrase(source, "morning")) {
    return {
      label: "morning (America/New_York)",
      days: [ny.weekday],
      startMin: 6 * 60,
      endMin: 12 * 60,
    };
  }

  if (hasPhrase(source, "afternoon")) {
    return {
      label: "afternoon (America/New_York)",
      days: [ny.weekday],
      startMin: 12 * 60,
      endMin: 17 * 60,
    };
  }

  if (hasPhrase(source, "evening")) {
    return {
      label: "evening (America/New_York)",
      days: [ny.weekday],
      startMin: Math.max(nowMin, 17 * 60),
      endMin: 21 * 60,
    };
  }

  return null;
}

export function parsePlaceSentence(sentence: string, now = new Date()): SentenceQuery {
  const text = sentence.trim();
  const interests: PlaceInterest[] = [];
  if (text) {
    for (const item of INTEREST_PHRASES) {
      if (hasPhrase(text, item.phrase) && !interests.includes(item.interest)) {
        interests.push(item.interest);
      }
    }
  }
  const freeOnly =
    hasPhrase(text, "free") ||
    hasPhrase(text, "free only") ||
    hasPhrase(text, "no cost");
  return {
    sentence: text,
    interests,
    costFilter: freeOnly ? "free" : "any",
    requestedTime: parseWindow(text, now),
    nearbyMentioned: hasPhrase(text, "nearby") || hasPhrase(text, "near") || hasPhrase(text, "walking"),
  };
}

export function estimatedWalkMinutes(distanceKmValue: number): number {
  const meters = Math.max(0, distanceKmValue) * 1000;
  return Math.round((meters / WALK_METERS_PER_MINUTE) * 10) / 10;
}

export function proximityValue(walkMinutes: number, maxWalkMinutes: number): number {
  const cap = parseMaxWalkMinutes(maxWalkMinutes);
  if (walkMinutes <= cap) return 1;
  return clamp(1 - (walkMinutes - cap) / cap, 0, 1);
}

function rangesOverlap(
  requested: { startMin: number; endMin: number },
  ranges: { startMin: number; endMin: number }[],
): boolean {
  return ranges.some((range) => requested.startMin < range.endMin && requested.endMin > range.startMin);
}

export function hoursMatch(
  hours: PlaceHours | null,
  requested: RequestedTime | null,
): { status: RankedScore["hoursStatus"]; evidence: string } {
  if (!requested) {
    return { status: "unknown", evidence: "No time was requested." };
  }
  if (!hours) {
    return {
      status: "unknown",
      evidence: "This record has no posted hours that can be compared.",
    };
  }

  let sawUsable = false;
  let anyOverlap = false;
  const notes: string[] = [];

  for (const day of requested.days) {
    const listed = hours.byDay[day];
    if (!listed) {
      const otherDays = Object.keys(hours.byDay);
      if (hours.source === "market-listed" && otherDays.length) {
        notes.push(`Listed days do not include the requested day.`);
        continue;
      }
      notes.push("No posted hours for the requested day.");
      continue;
    }
    if (listed.ranges == null) {
      notes.push(`Hours text (“${listed.raw}”) is not a reliable clock range.`);
      continue;
    }
    sawUsable = true;
    if (listed.ranges.length === 0) {
      notes.push(`Posted as closed (“${listed.raw}”).`);
      continue;
    }
    if (rangesOverlap({ startMin: requested.startMin, endMin: requested.endMin }, listed.ranges)) {
      anyOverlap = true;
      notes.push(`Overlaps posted hours (“${listed.raw}”).`);
    } else {
      notes.push(`Posted hours (“${listed.raw}”) do not overlap the requested window.`);
    }
  }

  if (!sawUsable) {
    return { status: "unknown", evidence: notes.join(" ") || "Hours are unknown." };
  }
  return {
    status: anyOverlap ? "matches" : "does_not_match",
    evidence: notes.join(" "),
  };
}

const AFFINITY: Record<PlaceInterest, Record<string, number>> = {
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

export function interestValue(place: ScoreablePlace, interests: PlaceInterest[]): {
  interest: PlaceInterest | null;
  value: number;
} {
  if (!interests.length) return { interest: null, value: 0 };
  let best: PlaceInterest = interests[0];
  let score = 0;
  for (const interest of interests) {
    let value = AFFINITY[interest]?.[place.category] ?? 0;
    if (place.interestHints?.includes(interest)) value = Math.max(value, 0.9);
    if (place.tags.some((tag) => hasPhrase(tag, interest))) value = Math.max(value, 0.85);
    if (value > score) {
      score = value;
      best = interest;
    }
  }
  return { interest: best, value: clamp(score, 0, 1) };
}

export function scorePlaceRecord(
  place: ScoreablePlace,
  args: {
    lat: number;
    lon: number;
    interests: PlaceInterest[];
    maxWalkMinutes: number;
    costFilter: CostFilter;
    requestedTime: RequestedTime | null;
  },
): RankedScore {
  const distanceKmValue = distanceKm(args.lat, args.lon, place.lat, place.lon);
  const meters = Math.round(distanceKmValue * 1000);
  const walkMinutes = estimatedWalkMinutes(distanceKmValue);
  const maxWalk = parseMaxWalkMinutes(args.maxWalkMinutes);
  const omitted: OmittedFactor[] = [...ALWAYS_OMITTED];
  const factors: ScoreFactor[] = [];

  if (args.costFilter === "free" && place.cost === "paid") {
    return {
      recommendationScore: 0,
      estimatedWalkMinutes: walkMinutes,
      distanceMeters: meters,
      walkLabel:
        "Straight-line estimate (meters ÷ 80), not a verified walking route or an actual 15-minute walk.",
      factors: [],
      omittedFactors: omitted,
      hoursStatus: "unknown",
      excluded: true,
      excludeReason: "Verified as paid, and the request is free only.",
    };
  }

  factors.push({
    id: "proximity",
    label: "Walking proximity (estimate)",
    value: proximityValue(walkMinutes, maxWalk),
    weight: 0.5,
    evidence: `About ${walkMinutes} min from a ${meters} m straight-line distance (÷ ${WALK_METERS_PER_MINUTE} m/min). Preferred limit ${maxWalk} min. Not a mapped route.`,
  });

  if (args.interests.length) {
    const match = interestValue(place, args.interests);
    factors.push({
      id: "interest",
      label: "Documented place characteristics",
      value: match.value,
      weight: 0.3,
      evidence: match.interest
        ? `Sentence asked for ${match.interest}. Category ${place.category.replace(/-/g, " ")}.`
        : "No documented characteristic matched the sentence.",
    });
  } else {
    omitted.push({
      id: "interest",
      reason: "The sentence did not name an interest tag, so none was added.",
    });
  }

  if (args.costFilter === "free") {
    if (place.cost === "unknown") {
      omitted.push({
        id: "cost",
        reason: "Cost is unknown in the record. Unknown is not treated as free, and the place is not excluded.",
      });
    }
  } else {
    omitted.push({
      id: "cost",
      reason: "No free-only request is in effect. Missing cost stays unknown.",
    });
  }

  const hours = hoursMatch(place.hours, args.requestedTime);
  if (!args.requestedTime) {
    omitted.push({
      id: "hours",
      reason: "The sentence did not request a time window.",
    });
  } else if (hours.status === "unknown") {
    omitted.push({
      id: "hours",
      reason: hours.evidence,
    });
  } else {
    factors.push({
      id: "hours",
      label: "Requested time vs posted hours",
      value: hours.status === "matches" ? 1 : 0,
      weight: 0.2,
      evidence: `${hours.evidence} Compared to ${place.hours?.source ?? "posted hours"}, not an event start/end.`,
    });
  }

  const weightSum = factors.reduce((sum, factor) => sum + factor.weight, 0) || 1;
  const raw = factors.reduce((sum, factor) => sum + factor.value * factor.weight, 0) / weightSum;
  const recommendationScore = Math.round(clamp(raw * 100, 0, 100) * 10) / 10;

  return {
    recommendationScore,
    estimatedWalkMinutes: walkMinutes,
    distanceMeters: meters,
    walkLabel:
      "Straight-line estimate (meters ÷ 80), not a verified walking route or an actual 15-minute walk.",
    factors,
    omittedFactors: omitted,
    hoursStatus: hours.status,
    excluded: false,
  };
}

export function compareRanked(
  a: { recommendationScore: number; estimatedWalkMinutes: number; title: string; id: string },
  b: { recommendationScore: number; estimatedWalkMinutes: number; title: string; id: string },
): number {
  return (
    b.recommendationScore - a.recommendationScore ||
    a.estimatedWalkMinutes - b.estimatedWalkMinutes ||
    a.title.localeCompare(b.title) ||
    a.id.localeCompare(b.id)
  );
}

function fieldText(value: unknown): string {
  const text = String(value ?? "").trim();
  if (!text || text.toUpperCase() === "NULL") return "";
  return text;
}
