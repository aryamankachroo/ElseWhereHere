import type {
  AskResult,
  Bootstrap,
  CityEventsResult,
  DiscoverResult,
  MatchQuestionnaire,
  MatchResult,
  PlaceInterest,
  PlacesResult,
} from "./types";

async function parse<T>(res: Response): Promise<T> {
  const data = (await res.json()) as T & { error?: string };
  if (!res.ok) {
    throw new Error(data.error || `Request failed (${res.status})`);
  }
  return data;
}

export function loadBootstrap(): Promise<Bootstrap> {
  return fetch("/api/bootstrap").then((r) => parse<Bootstrap>(r));
}

export function requestMatch(answers: MatchQuestionnaire): Promise<MatchResult> {
  const description = [answers.place, answers.memory].filter(Boolean).join(". ");
  const body: Record<string, unknown> = {
    description,
    place: answers.place,
    memory: answers.memory,
  };
  if (answers.preference && answers.weights) {
    body.preference = answers.preference;
    body.weights = answers.weights;
  }
  return fetch("/api/match", {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify(body),
  }).then((r) => parse<MatchResult>(r));
}

export function requestAsk(
  neighborhoodId: string,
  question: string,
): Promise<AskResult> {
  return fetch("/api/ask", {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ neighborhoodId, question }),
  }).then((r) => parse<AskResult>(r));
}

export function requestEvents(borough: string): Promise<CityEventsResult> {
  return fetch(`/api/events?borough=${encodeURIComponent(borough)}`).then((r) =>
    parse<CityEventsResult>(r),
  );
}

export function requestDiscover(
  lat: number,
  lon: number,
  borough?: string,
): Promise<DiscoverResult> {
  const params = new URLSearchParams({
    lat: String(lat),
    lon: String(lon),
  });
  if (borough) params.set("borough", borough);
  return fetch(`/api/discover?${params}`).then((r) => parse<DiscoverResult>(r));
}

export function requestPlaces(args: {
  lat: number;
  lon: number;
  borough?: string;
  sentence?: string;
  interests?: PlaceInterest[];
  maxWalkMinutes?: number;
  cost?: "any" | "free";
}): Promise<PlacesResult> {
  const params = new URLSearchParams({
    lat: String(args.lat),
    lon: String(args.lon),
  });
  if (args.borough) params.set("borough", args.borough);
  if (args.sentence) params.set("sentence", args.sentence);
  if (args.interests?.length) params.set("interests", args.interests.join(","));
  if (args.maxWalkMinutes != null) params.set("maxWalkMinutes", String(args.maxWalkMinutes));
  if (args.cost) params.set("cost", args.cost);
  return fetch(`/api/places?${params}`).then((r) => parse<PlacesResult>(r));
}
