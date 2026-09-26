export const DIMENSIONS = [
  "energy",
  "food",
  "greenery",
  "arts",
  "gathering",
  "smallShops",
] as const;

export type DimensionId = (typeof DIMENSIONS)[number];

export const DIMENSION_LABELS: Record<DimensionId, string> = {
  energy: "street energy",
  food: "food scene",
  greenery: "greenery",
  arts: "arts and music",
  gathering: "social gathering",
  smallShops: "small shops",
};

const KEY_ALIASES: Record<string, DimensionId> = {
  energy: "energy",
  streetEnergy: "energy",
  food: "food",
  greenery: "greenery",
  arts: "arts",
  gathering: "gathering",
  socialGathering: "gathering",
  smallShops: "smallShops",
};

function canonicalDimension(value: string): DimensionId | null {
  return KEY_ALIASES[value] ?? null;
}

export const VIBE_DATA_NOTE =
  "Neighborhood 0–4 scores are illustrative editorial interpretations for this demo, not official NYC statistics, agency ratings, or NYC Open Data measures of vibe.";

export type DimensionScores = Record<DimensionId, number>;

export type WeightedPriority = {
  dimension: DimensionId;
  weight: number;
};

export type NeighborhoodVibe = {
  id: string;
  name: string;
  borough: string;
  difference: string;
  vibeScores: DimensionScores;
  vibeScoreNotes: Partial<Record<DimensionId, string>>;
};

export type DimensionCompare = {
  dimension: DimensionId;
  label: string;
  preference: number;
  neighborhood: number;
  gap: number;
  note?: string;
};

export type ScoreBreakdownRow = {
  dimension: DimensionId;
  label: string;
  weight: number;
  preference: number;
  neighborhood: number;
  absDiff: number;
  weightedDiff: number;
};

export type RankedMatch = {
  id: string;
  name: string;
  borough: string;
  score: number;
  matchingQualities: DimensionCompare[];
  differences: DimensionCompare[];
  meaningfulDifference: string;
  breakdown: ScoreBreakdownRow[];
};

function clamp04(value: number): number {
  if (!Number.isFinite(value)) return 0;
  return Math.min(4, Math.max(0, value));
}

export function isDimensionId(value: string): value is DimensionId {
  return (DIMENSIONS as readonly string[]).includes(value);
}

/**
 * Priorities keep the 0.5 / 0.3 / 0.2 weights. The other three dimensions
 * still participate at 0.1 each so unused sliders are not ignored.
 */
export function scoringWeights(priorities: WeightedPriority[]): WeightedPriority[] {
  const chosen = new Map(
    priorities
      .filter((p) => p.weight > 0 && isDimensionId(p.dimension))
      .map((p) => [p.dimension, p.weight]),
  );
  return DIMENSIONS.map((dimension) => ({
    dimension,
    weight: chosen.get(dimension) ?? 0.1,
  }));
}

export function scoreBreakdown(
  place: DimensionScores,
  preferences: DimensionScores,
  priorities: WeightedPriority[],
): { score: number; breakdown: ScoreBreakdownRow[] } {
  const weights = scoringWeights(priorities);
  const sumWeights = weights.reduce((sum, p) => sum + p.weight, 0);
  const breakdown = weights.map((p) => {
    const preference = clamp04(preferences[p.dimension]);
    const neighborhood = clamp04(place[p.dimension]);
    const absDiff = Math.abs(preference - neighborhood);
    return {
      dimension: p.dimension,
      label: DIMENSION_LABELS[p.dimension],
      weight: p.weight,
      preference,
      neighborhood,
      absDiff,
      weightedDiff: p.weight * absDiff,
    };
  });
  const weightedGap = breakdown.reduce((sum, row) => sum + row.weightedDiff, 0);
  const score = sumWeights <= 0 ? 0 : 100 * (1 - weightedGap / (4 * sumWeights));
  return { score: Math.round(score * 10) / 10, breakdown };
}

export function compareDimensions(
  place: NeighborhoodVibe,
  preferences: DimensionScores,
  priorities: WeightedPriority[],
): { matchingQualities: DimensionCompare[]; differences: DimensionCompare[] } {
  const matchingQualities: DimensionCompare[] = [];
  const differences: DimensionCompare[] = [];

  for (const p of priorities) {
    if (!isDimensionId(p.dimension) || p.weight <= 0) continue;
    const preference = clamp04(preferences[p.dimension]);
    const neighborhood = clamp04(place.vibeScores[p.dimension]);
    const gap = Math.abs(preference - neighborhood);
    const row: DimensionCompare = {
      dimension: p.dimension,
      label: DIMENSION_LABELS[p.dimension],
      preference,
      neighborhood,
      gap,
      note: place.vibeScoreNotes[p.dimension],
    };
    if (gap <= 1) matchingQualities.push(row);
    if (gap >= 2) differences.push(row);
  }

  matchingQualities.sort((a, b) => a.gap - b.gap || b.neighborhood - a.neighborhood);
  differences.sort((a, b) => b.gap - a.gap);
  return { matchingQualities, differences };
}

export function rankNeighborhoods(
  places: NeighborhoodVibe[],
  preferences: DimensionScores,
  priorities: WeightedPriority[],
): RankedMatch[] {
  return places
    .map((place) => {
      const { score, breakdown } = scoreBreakdown(place.vibeScores, preferences, priorities);
      const { matchingQualities, differences } = compareDimensions(
        place,
        preferences,
        priorities,
      );
      return {
        id: place.id,
        name: place.name,
        borough: place.borough,
        score,
        matchingQualities,
        differences,
        meaningfulDifference: place.difference,
        breakdown,
      };
    })
    .sort((a, b) => b.score - a.score || a.name.localeCompare(b.name));
}

function readPreferenceMap(source: Record<string, unknown> | undefined): DimensionScores | null {
  if (!source) return null;
  const preferences = {} as DimensionScores;
  for (const id of DIMENSIONS) {
    const raw = source[id] ?? (id === "energy" ? source.streetEnergy : undefined) ?? (id === "gathering" ? source.socialGathering : undefined);
    const n = Number(raw);
    if (!Number.isFinite(n) || n < 0 || n > 4) return null;
    preferences[id] = n;
  }
  return preferences;
}

export function parseQuestionnaire(body: unknown): {
  preferences: DimensionScores;
  priorities: WeightedPriority[];
} | null {
  if (!body || typeof body !== "object") return null;
  const raw = body as {
    preference?: Record<string, unknown>;
    preferences?: Record<string, unknown>;
    weights?: Record<string, unknown>;
    priorities?: unknown;
  };

  const preferences = readPreferenceMap(raw.preference) ?? readPreferenceMap(raw.preferences);
  if (!preferences) return null;

  if (raw.weights && typeof raw.weights === "object" && !Array.isArray(raw.weights)) {
    const priorities: WeightedPriority[] = [];
    const seen = new Set<DimensionId>();
    for (const [key, value] of Object.entries(raw.weights)) {
      const dimension = canonicalDimension(key);
      const weight = Number(value);
      if (!dimension || seen.has(dimension) || !Number.isFinite(weight) || weight <= 0) return null;
      seen.add(dimension);
      priorities.push({ dimension, weight });
    }
    if (priorities.length !== 3) return null;
    priorities.sort((a, b) => b.weight - a.weight);
    return { preferences, priorities };
  }

  if (!Array.isArray(raw.priorities) || raw.priorities.length !== 3) return null;

  const seen = new Set<DimensionId>();
  const priorities: WeightedPriority[] = [];
  for (const item of raw.priorities) {
    if (!item || typeof item !== "object") return null;
    const dimension = canonicalDimension(String((item as { dimension?: unknown }).dimension ?? ""));
    const weight = Number((item as { weight?: unknown }).weight);
    if (!dimension || seen.has(dimension) || !Number.isFinite(weight) || weight <= 0) {
      return null;
    }
    seen.add(dimension);
    priorities.push({ dimension, weight });
  }
  if (priorities.length !== 3) return null;
  return { preferences, priorities };
}
