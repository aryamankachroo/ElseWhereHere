import { readFileSync } from "node:fs";
import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";

const root = join(dirname(fileURLToPath(import.meta.url)), "..");

function loadJson<T>(rel: string): T {
  return JSON.parse(readFileSync(join(root, rel), "utf8")) as T;
}

export type TagWeight = { id: string; weight: number };

export type VibeScores = {
  energy: number;
  food: number;
  greenery: number;
  arts: number;
  gathering: number;
  smallShops: number;
};

export type VisitStop = {
  id: string;
  title: string;
  minutes: number;
  lat: number;
  lon: number;
  isArrival?: boolean;
  emphasizes: (keyof VibeScores)[];
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

export type Neighborhood = {
  id: string;
  name: string;
  borough: string;
  latitude: number;
  longitude: number;
  shortLine: string;
  photo: { src: string; alt: string; credit: string; creditUrl: string };
  tags: TagWeight[];
  reasonByTag: Record<string, string>;
  difference: string;
  tagRationale: string;
  explorePrompt: string;
  vibeScores: VibeScores;
  vibeScoreNotes: Partial<Record<keyof VibeScores, string>>;
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

export type Source = {
  id: string;
  neighborhoodId: string;
  title: string;
  url: string;
  license: string;
  text: string;
};

export type Passage = {
  id: string;
  sourceId: string;
  neighborhoodId: string;
  title: string;
  url: string;
  text: string;
};

export const neighborhoodData = loadJson<{ neighborhoods: Neighborhood[] }>(
  "data/neighborhoods.json",
);
export const lexiconData = loadJson<{
  examples: { id: string; label: string; text: string }[];
  keywords: { tag: string; words: string[] }[];
}>("data/lexicon.json");
export const storyData = loadJson<{ stories: Record<string, Story> }>(
  "data/stories.json",
);
export const sourceData = loadJson<{ sources: Source[] }>("data/sources.json");

export function splitPassages(sources: Source[]): Passage[] {
  const passages: Passage[] = [];
  for (const source of sources) {
    const sentences = source.text.split(/(?<=[.!?])\s+/);
    let buf = "";
    let n = 0;
    const flush = () => {
      const text = buf.trim();
      if (text.length < 40) return;
      passages.push({
        id: `${source.id}-p${n}`,
        sourceId: source.id,
        neighborhoodId: source.neighborhoodId,
        title: source.title,
        url: source.url,
        text,
      });
      n += 1;
      buf = "";
    };
    for (const sentence of sentences) {
      if ((buf + " " + sentence).trim().length > 520) flush();
      buf = `${buf} ${sentence}`.trim();
    }
    flush();
  }
  return passages;
}

export const passages = splitPassages(sourceData.sources);

export function getNeighborhood(id: string): Neighborhood | undefined {
  return neighborhoodData.neighborhoods.find((n) => n.id === id);
}
