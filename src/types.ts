export type ExamplePrompt = { id: string; label: string; text: string };

export type Photo = {
  src: string;
  alt: string;
  credit: string;
  creditUrl: string;
};

export type VisitStop = {
  id: string;
  title: string;
  minutes: number;
  lat: number;
  lon: number;
  isArrival?: boolean;
  emphasizes: DimensionId[];
  do: string;
  lookFor: string;
};

export type VisitGuide = {
  duration: string;
  bestTime: string;
  worthTheTrip: string;
  skipIf: string;
  arrive: {
    summary: string;
    station: string;
    fromMidtownMinutes: number;
    caution: string;
  };
  groundRules: string[];
  stops: VisitStop[];
};

export type NeighborhoodCard = {
  id: string;
  name: string;
  borough: string;
  shortLine: string;
  photo: Photo;
  explorePrompt: string;
  latitude: number;
  longitude: number;
  visitGuide: VisitGuide;
};

export type StoryChoice = { id: string; label: string; reveal: string };

export type Story = {
  minutes: number;
  start: {
    visual: string;
    visualAlt: string;
    passage: string;
    choices: StoryChoice[];
  };
  closingQuestion: string;
};

export type Bootstrap = {
  examples: ExamplePrompt[];
  neighborhoods: NeighborhoodCard[];
  stories: Record<string, Story>;
  sourceIndex: { id: string; neighborhoodId: string; title: string; url: string }[];
  aiConfigured: boolean;
};

export type DimensionId =
  | "energy"
  | "food"
  | "greenery"
  | "arts"
  | "gathering"
  | "smallShops";

export type DimensionCompare = {
  dimension: DimensionId;
  label: string;
  preference: number;
  neighborhood: number;
  gap: number;
  note?: string;
};

export type RankedMatch = {
  id: string;
  name: string;
  borough: string;
  score: number;
  matchingQualities: DimensionCompare[];
  differences: DimensionCompare[];
  meaningfulDifference: string;
  breakdown?: {
    dimension: DimensionId;
    label: string;
    weight: number;
    preference: number;
    neighborhood: number;
    absDiff: number;
    weightedDiff: number;
  }[];
};

export type MatchQuestionnaire = {
  preference?: Record<DimensionId, number>;
  weights?: Partial<Record<DimensionId, number>>;
  place?: string;
  memory?: string;
};

export type MatchResult = {
  neighborhoodId: string;
  name: string;
  borough: string;
  shortLine: string;
  photo: Photo;
  interpretationNote: string;
  matchedQualities: { tag: string; label: string }[];
  reasons: string[];
  difference: string;
  tagRationale: string;
  usedAI: boolean;
  fallback: boolean;
  scores?: { id: string; name: string; score: number }[];
  similarity: {
    score: number;
    dataNote: string;
    matchingQualities: DimensionCompare[];
    differences: DimensionCompare[];
    ranked: RankedMatch[];
  } | null;
  visitGuide: VisitGuide;
  differenceSource: { title: string; url: string } | null;
  visitHere: {
    title: string;
    do: string;
    lookFor: string;
    lat: number;
    lon: number;
  };
};

export type AskResult = {
  answer: string;
  citations: { title: string; url: string; sourceId: string }[];
  insufficient: boolean;
  usedAI: boolean;
};

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

export type CityEventsResult = {
  label: string;
  disclaimer: string;
  borough: string;
  records: PermittedEventRecord[];
  error?: string;
};

export type DiscoverPlace = {
  title: string;
  location: string;
  material: string;
  kind: string;
  inscription: string;
  lat: number;
  lon: number;
  distanceKm: number;
  borough?: string;
  source: string;
};

export type DiscoverResult = {
  label: string;
  disclaimer: string;
  lat: number;
  lon: number;
  places: DiscoverPlace[];
  resource?: string;
  error?: string;
};

export type Screen =
  | "landing"
  | "welcome"
  | "match"
  | "story"
  | "challenge"
  | "reflect"
  | "ask"
  | "citywide";

export type PlaceInterest =
  | "food"
  | "markets"
  | "gardens"
  | "art"
  | "history"
  | "shops"
  | "quiet";

export type PlaceCategory =
  | "public-art"
  | "farmers-market"
  | "community-garden"
  | "public-space"
  | "restaurant"
  | "shop";

export type ScoreFactor = {
  id: string;
  label: string;
  value: number;
  weight: number;
  evidence: string;
};

export type OmittedFactor = {
  id: string;
  reason: string;
};

export type PlaceRecommendation = {
  id: string;
  title: string;
  category: PlaceCategory;
  borough: string;
  lat: number;
  lon: number;
  detail: string;
  sourceUrl: string;
  datasetId: string;
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
  cuisine?: string;
  cost: "paid" | "unknown";
};

export type PlaceSourceStatus = {
  datasetId: string;
  name: string;
  catalogUrl: string;
  available: boolean;
  recordCount: number;
  error?: string;
};

export type PlacesResult = {
  label: string;
  disclaimer: string;
  borough: string | null;
  interests: PlaceInterest[];
  sentence: string;
  requestedTime: { label: string; days: number[]; startMin: number; endMin: number } | null;
  costFilter: "any" | "free";
  maxWalkMinutes: number;
  lat: number;
  lon: number;
  weights: { factor: string; weight: number }[];
  omittedFactors: OmittedFactor[];
  sources: PlaceSourceStatus[];
  primary: PlaceRecommendation | null;
  nearby: PlaceRecommendation[];
  recommendations: PlaceRecommendation[];
  error?: string;
};

/** @deprecated Use PlacesResult — kept for the old /api/citywide shape in UI types. */
export type CitywidePlace = PlaceRecommendation;
export type CitywideResult = PlacesResult & {
  interest?: PlaceInterest;
  results?: PlaceRecommendation[];
};
