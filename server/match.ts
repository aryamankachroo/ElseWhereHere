import { lexiconData, neighborhoodData, sourceData, type Neighborhood } from "./data.js";
import { chatJson } from "./ai.js";
import {
  DIMENSION_LABELS,
  VIBE_DATA_NOTE,
  parseQuestionnaire,
  rankNeighborhoods,
  type DimensionCompare,
  type RankedMatch,
} from "./similarity.js";
import { tokenize } from "./text.js";

const TEXT_BLEND = 45;

function catalogLimitNote(): string {
  const names = neighborhoodData.neighborhoods.map((n) => n.name);
  return `This demo only ranks ${names.length} curated neighborhoods (${names.join(", ")}). It does not search the rest of the city, and NYC Open Data is not used to score vibe.`;
}

function escapeRegExp(value: string): string {
  return value.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");
}

/** Whole-word / whole-phrase match so "eat" does not hit "great" or "theater". */
export function containsKeyword(haystack: string, keyword: string): boolean {
  const needle = keyword.trim().toLowerCase();
  if (needle.length < 3) return false;
  const parts = needle.split(/\s+/).map(escapeRegExp);
  const pattern = new RegExp(`(?:^|[^a-z0-9])${parts.join("\\s+")}(?:[^a-z0-9]|$)`, "i");
  return pattern.test(haystack);
}

export function tagsFromKeywords(description: string): Map<string, number> {
  const scores = new Map<string, number>();
  for (const entry of lexiconData.keywords) {
    let hits = 0;
    for (const word of entry.words) {
      if (containsKeyword(description, word)) hits += 1;
    }
    if (hits) scores.set(entry.tag, hits);
  }
  return scores;
}

function tagsFromExactTokens(description: string): Map<string, number> {
  const tokens = new Set(tokenize(description));
  const scores = new Map<string, number>();
  if (tokens.size === 0) return scores;
  for (const entry of lexiconData.keywords) {
    let hits = 0;
    for (const word of entry.words) {
      const parts = word.toLowerCase().split(/\s+/);
      if (parts.length === 1 && tokens.has(parts[0]!)) hits += 1;
      else if (parts.length > 1 && parts.every((part) => tokens.has(part))) hits += 1;
    }
    if (hits) scores.set(entry.tag, hits);
  }
  return scores;
}

export type MatchResult = {
  neighborhoodId: string;
  name: string;
  borough: string;
  shortLine: string;
  photo: Neighborhood["photo"];
  interpretationNote: string;
  matchedQualities: { tag: string; label: string }[];
  reasons: string[];
  difference: string;
  tagRationale: string;
  usedAI: boolean;
  fallback: boolean;
  scores: { id: string; name: string; score: number }[];
  similarity: {
    score: number;
    dataNote: string;
    matchingQualities: DimensionCompare[];
    differences: DimensionCompare[];
    ranked: RankedMatch[];
  } | null;
  visitGuide: Neighborhood["visitGuide"];
  differenceSource: { title: string; url: string } | null;
  visitHere: {
    title: string;
    do: string;
    lookFor: string;
    lat: number;
    lon: number;
  };
};

const TAG_LABELS: Record<string, string> = {
  "dense-street-life": "dense street life",
  "food-markets": "food and markets",
  multilingual: "many languages in public",
  "apartment-living": "apartment living",
  "garden-courtyards": "shared courtyards",
  "everyday-errands": "everyday errands on foot",
  bustling: "a bustling soundscape",
  "communal-sidewalks": "sidewalks as gathering space",
  waterfront: "a waterfront edge",
  industrial: "industrial building fabric",
  "slower-pace": "a slower pace",
  maritime: "maritime work and geography",
  warehouse: "warehouses",
  "open-sky": "open sky",
  "isolated-enclave": "a place you go on purpose",
  "community-spaces": "local community spaces",
  "working-waterfront": "a working waterfront",
  "parks-nature": "parks and nature close at hand",
  forest: "forest",
  hilly: "hills and steep walks",
  "residential-quiet": "a quieter residential rhythm",
  "river-views": "rivers and wetlands",
  "end-of-the-line": "the end of the island or line",
  "weekend-in-the-park": "the park as a weekend room",
  "neighborhood-scale": "neighborhood-scale streets",
};

function scoreNeighborhood(
  n: Neighborhood,
  quality: Map<string, number>,
): { score: number; overlap: string[] } {
  let score = 0;
  const overlap: { tag: string; w: number }[] = [];
  for (const t of n.tags) {
    const q = quality.get(t.id) ?? 0;
    if (q > 0) {
      const w = q * t.weight;
      score += w;
      overlap.push({ tag: t.id, w });
    }
  }
  overlap.sort((a, b) => b.w - a.w);
  return { score, overlap: overlap.map((o) => o.tag) };
}

function fallbackReasons(n: Neighborhood, tags: string[]): string[] {
  const unique = [...new Set(tags)];
  const reasons = unique
    .map((tag) => n.reasonByTag[tag])
    .filter(Boolean)
    .slice(0, 3);
  if (reasons.length >= 2) return reasons;
  const extras = n.tags
    .map((t) => n.reasonByTag[t.id])
    .filter((r) => r && !reasons.includes(r));
  return [...reasons, ...extras].slice(0, 3);
}

export async function matchDescription(
  description: string,
  questionnaireBody?: unknown,
): Promise<MatchResult> {
  const body =
    questionnaireBody && typeof questionnaireBody === "object"
      ? (questionnaireBody as Record<string, unknown>)
      : null;
  const fromFields = [body?.place, body?.memory, description]
    .map((value) => String(value ?? "").trim())
    .filter(Boolean)
    .join(". ");
  const trimmed = fromFields || description.trim();

  const questionnaire = parseQuestionnaire(questionnaireBody);
  if (!questionnaire && body && ("preference" in body || "preferences" in body || "weights" in body || "priorities" in body)) {
    throw Object.assign(
      new Error("Rate each quality from 0–4 and choose three different priorities with weights."),
      { status: 400 },
    );
  }
  if (!questionnaire && trimmed.length < 4) {
    throw Object.assign(new Error("Name a place you miss, even in a few words."), {
      status: 400,
    });
  }

  let quality = tagsFromKeywords(trimmed);
  let usedAI = false;

  if (quality.size > 0 && trimmed.length >= 12) {
    try {
      const extracted = await chatJson<{ qualities: string[] }>(
        `Extract 3 to 8 atmosphere qualities from this description of a place someone loves.
Return JSON {"qualities":["tag-id",...] } using ONLY these tag ids:
${Object.keys(TAG_LABELS).join(", ")}
Description:
${trimmed}`,
      );
      if (extracted?.qualities?.length) {
        usedAI = true;
        const merged = new Map(quality);
        for (const tag of extracted.qualities) {
          if (TAG_LABELS[tag]) merged.set(tag, (merged.get(tag) ?? 0) + 2);
        }
        quality = merged;
      }
    } catch {
      usedAI = false;
    }
  }

  if (quality.size === 0) {
    quality = tagsFromExactTokens(trimmed);
  }

  const ranked = neighborhoodData.neighborhoods
    .map((n) => {
      const { score, overlap } = scoreNeighborhood(n, quality);
      return { n, score, overlap };
    })
    .sort((a, b) => b.score - a.score || a.n.name.localeCompare(b.n.name));

  const similarityRanked = questionnaire
    ? rankNeighborhoods(neighborhoodData.neighborhoods, questionnaire.preferences, questionnaire.priorities)
    : null;

  const picked = pickNeighborhood(ranked, similarityRanked);
  if (!picked) {
    throw Object.assign(
      new Error(
        `Need one more clue: name something specific (markets, waterfront, woods) or rate the six qualities. ${catalogLimitNote()}`,
      ),
      { status: 400 },
    );
  }

  return finishMatch({
    chosen: picked.chosen,
    trimmed,
    usedAI,
    similarityRanked,
    topSimilarity: picked.topSimilarity,
    scores: picked.scores,
  });
}

type TextRank = { n: Neighborhood; score: number; overlap: string[] };

export function pickNeighborhood(
  textRanked: TextRank[],
  similarityRanked: RankedMatch[] | null,
): {
  chosen: { n: Neighborhood; overlap: string[] };
  topSimilarity: RankedMatch | null;
  scores: { id: string; name: string; score: number }[];
} | null {
  const textById = new Map(textRanked.map((row) => [row.n.id, row]));
  const maxText = Math.max(0, ...textRanked.map((row) => row.score));

  if (similarityRanked && similarityRanked.length > 0) {
    const combined = similarityRanked
      .map((row) => {
        const text = textById.get(row.id);
        const textScore = text?.score ?? 0;
        const textPart = maxText > 0 ? TEXT_BLEND * (textScore / maxText) : 0;
        return {
          id: row.id,
          name: row.name,
          score: Math.round((row.score + textPart) * 10) / 10,
          textScore,
          overlap: text?.overlap ?? [],
          sim: row,
        };
      })
      .sort((a, b) => b.score - a.score || b.textScore - a.textScore || a.name.localeCompare(b.name));

    const top = combined[0]!;
    const neighborhood = neighborhoodData.neighborhoods.find((n) => n.id === top.id);
    if (!neighborhood) return null;
    return {
      chosen: { n: neighborhood, overlap: top.overlap },
      topSimilarity: top.sim,
      scores: combined.map((row) => ({ id: row.id, name: row.name, score: row.score })),
    };
  }

  const best = textRanked[0];
  if (!best || best.score <= 0) return null;
  const second = textRanked[1];
  if (second && second.score > 0) {
    const gap = best.score - second.score;
    const ratio = best.score / second.score;
    if (gap < 0.35 && ratio < 1.12) return null;
  }
  return {
    chosen: { n: best.n, overlap: best.overlap },
    topSimilarity: null,
    scores: textRanked.map((row) => ({
      id: row.n.id,
      name: row.n.name,
      score: Math.round(row.score * 10) / 10,
    })),
  };
}

async function finishMatch(args: {
  chosen: { n: Neighborhood; overlap: string[] };
  trimmed: string;
  usedAI: boolean;
  similarityRanked: RankedMatch[] | null;
  topSimilarity: RankedMatch | null;
  scores: { id: string; name: string; score: number }[];
}): Promise<MatchResult> {
  const { chosen, trimmed, similarityRanked, topSimilarity, scores } = args;
  let { usedAI } = args;

  const fromText = chosen.overlap.slice(0, 6).map((tag) => ({
    tag,
    label: TAG_LABELS[tag] ?? tag,
  }));
  const fromSliders =
    topSimilarity?.matchingQualities.map((q) => ({
      tag: q.dimension,
      label: q.label,
    })) ?? [];
  const seen = new Set<string>();
  const matchedQualities: { tag: string; label: string }[] = [];
  for (const row of [...fromText, ...fromSliders]) {
    if (seen.has(row.tag)) continue;
    seen.add(row.tag);
    matchedQualities.push(row);
  }

  const vibeReasons =
    topSimilarity?.matchingQualities
      .map((q) => q.note)
      .filter((note): note is string => Boolean(note))
      .slice(0, 3) ?? [];
  const reasons =
    chosen.overlap.length > 0
      ? fallbackReasons(chosen.n, chosen.overlap)
      : vibeReasons.length >= 2
        ? vibeReasons
        : fallbackReasons(chosen.n, chosen.overlap);
  let finalReasons = reasons.length ? reasons : vibeReasons.slice(0, 3);
  if (chosen.overlap.length > 0) {
    try {
      const explained = await chatJson<{ reasons: string[] }>(
        `A visitor described a place they love:
"${trimmed}"

We matched them to ${chosen.n.name}, ${chosen.n.borough} because of these overlapping qualities: ${chosen.overlap.join(", ")}.

Using ONLY these neighborhood facts, write 2 or 3 short reasons (one sentence each) for the match. Each reason must name something specific about ${chosen.n.name}. Do not say it is the same as the visitor's city or culture.
Facts:
${[
  ...chosen.overlap.map((t) => `- ${t}: ${chosen.n.reasonByTag[t]}`),
  ...(topSimilarity?.matchingQualities ?? []).map(
    (q) => `- ${q.label}: visitor ${q.preference}/4, place ${q.neighborhood}/4. ${q.note ?? ""}`,
  ),
].join("\n")}

Return JSON {"reasons":["..."]}`,
      );
      if (explained?.reasons?.length) {
        finalReasons = explained.reasons.slice(0, 3);
        usedAI = true;
      }
    } catch {
      /* keep fallback reasons */
    }
  }

  const interpretationNote = topSimilarity
    ? `Among Jackson Heights, Red Hook, and Inwood only. A likeness of feeling—not the same place or culture. ${catalogLimitNote()}`
    : `Among Jackson Heights, Red Hook, and Inwood only. A likeness of feeling from what you wrote—not the same place or culture. ${catalogLimitNote()}`;

  const stop =
    chosen.n.visitGuide.stops.find((item) => !item.isArrival) ?? chosen.n.visitGuide.stops[0];

  return {
    neighborhoodId: chosen.n.id,
    name: chosen.n.name,
    borough: chosen.n.borough,
    shortLine: chosen.n.shortLine,
    photo: chosen.n.photo,
    interpretationNote,
    matchedQualities,
    reasons: finalReasons,
    difference: differenceText(chosen.n, topSimilarity),
    tagRationale: `${chosen.n.tagRationale} ${catalogLimitNote()}`,
    usedAI,
    fallback: !usedAI,
    scores,
    similarity: topSimilarity
      ? {
          score: topSimilarity.score,
          dataNote: VIBE_DATA_NOTE,
          matchingQualities: topSimilarity.matchingQualities,
          differences: topSimilarity.differences,
          ranked: similarityRanked!,
        }
      : null,
    visitGuide: chosen.n.visitGuide,
    differenceSource: differenceSourceFor(chosen.n.id),
    visitHere: stop
      ? {
          title: stop.title,
          do: stop.do,
          lookFor: stop.lookFor,
          lat: stop.lat,
          lon: stop.lon,
        }
      : {
          title: chosen.n.name,
          do: chosen.n.shortLine,
          lookFor: "",
          lat: chosen.n.latitude,
          lon: chosen.n.longitude,
        },
  };
}

const DIFFERENCE_SOURCE_ID: Record<string, string> = {
  "jackson-heights": "lpc-jackson-heights",
  "red-hook": "wiki-red-hook",
  inwood: "nyc-parks-inwood-hill",
};

function differenceSourceFor(neighborhoodId: string): { title: string; url: string } | null {
  const preferred = DIFFERENCE_SOURCE_ID[neighborhoodId];
  const source =
    sourceData.sources.find((item) => item.id === preferred) ??
    sourceData.sources.find((item) => item.neighborhoodId === neighborhoodId);
  if (!source) return null;
  return { title: source.title, url: source.url };
}

function differenceText(n: Neighborhood, top: RankedMatch | null): string {
  if (!top) return n.difference;
  const gaps = top.differences.map((d) => {
    const label = DIMENSION_LABELS[d.dimension];
    const direction = d.neighborhood > d.preference ? "higher" : "lower";
    return `${n.name} is editorially ${direction} on ${label} (${d.neighborhood}/4) than your preference (${d.preference}/4)`;
  });
  if (!gaps.length) return n.difference;
  return `${gaps.join(". ")}. ${n.difference}`;
}
