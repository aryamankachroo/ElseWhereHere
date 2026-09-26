import { getNeighborhood, passages, type Passage } from "./data.js";
import { chatText } from "./ai.js";
import { cosine, termFreq, tokenize } from "./text.js";

const MIN_SCORE = 0.08;

export type Citation = { title: string; url: string; sourceId: string };

export type AskResult = {
  answer: string;
  citations: Citation[];
  insufficient: boolean;
  usedAI: boolean;
};

function retrieve(neighborhoodId: string, question: string, k = 4): { passage: Passage; score: number }[] {
  const q = termFreq(tokenize(question));
  return passages
    .filter((p) => p.neighborhoodId === neighborhoodId)
    .map((passage) => ({
      passage,
      score: cosine(q, termFreq(tokenize(passage.text))),
    }))
    .sort((a, b) => b.score - a.score)
    .slice(0, k);
}

function uniqueCitations(hits: { passage: Passage }[]): Citation[] {
  const seen = new Set<string>();
  const out: Citation[] = [];
  for (const { passage } of hits) {
    if (seen.has(passage.sourceId)) continue;
    seen.add(passage.sourceId);
    out.push({
      title: passage.title,
      url: passage.url,
      sourceId: passage.sourceId,
    });
  }
  return out;
}

function extractiveAnswer(hits: { passage: Passage; score: number }[]): string {
  const bits = hits
    .filter((h) => h.score >= MIN_SCORE)
    .slice(0, 2)
    .map((h) => h.passage.text.split(/(?<=[.!?])\s+/).slice(0, 2).join(" "));
  return bits.join(" ");
}

export async function askNeighborhood(
  neighborhoodId: string,
  question: string,
): Promise<AskResult> {
  const n = getNeighborhood(neighborhoodId);
  if (!n) {
    throw Object.assign(new Error("Unknown neighborhood."), { status: 404 });
  }
  const q = question.trim();
  if (q.length < 8) {
    throw Object.assign(new Error("Ask a fuller question about this place."), {
      status: 400,
    });
  }

  const hits = retrieve(neighborhoodId, q);
  const best = hits[0]?.score ?? 0;
  const insufficient =
    best < MIN_SCORE ||
    hits.length === 0 ||
    /michelin|star rating|best restaurant|ranked|itinerary|uber|taxi fare/i.test(q);

  if (insufficient) {
    return {
      answer: `The curated sources for ${n.name} do not support a reliable answer to that question. Try asking about the neighborhood’s streets, parks, housing, waterfront or forest, historic designation, or documented history—topics covered in the listed sources.`,
      citations: [],
      insufficient: true,
      usedAI: false,
    };
  }

  const context = hits
    .map(
      (h, i) =>
        `[${i + 1}] ${h.passage.title} (${h.passage.url})\n${h.passage.text}`,
    )
    .join("\n\n");

  let usedAI = false;
  let answer: string | null = null;
  try {
    answer = await chatText(
      `Answer only from the numbered passages. If they are not enough, say so plainly.
Cite by repeating the source titles you used. Do not invent sources, quotes, or statistics.
Keep the answer to 2–4 sentences. Neighborhood: ${n.name}, ${n.borough}.`,
      `Question: ${q}\n\nPassages:\n${context}`,
    );
    if (answer) usedAI = true;
  } catch {
    answer = null;
  }

  if (!answer) {
    answer = extractiveAnswer(hits);
    if (!answer) {
      return {
        answer: `The retrieved passages for ${n.name} are too weak to answer that from the curated sources.`,
        citations: [],
        insufficient: true,
        usedAI: false,
      };
    }
  }

  return {
    answer,
    citations: uniqueCitations(hits.filter((h) => h.score >= MIN_SCORE)),
    insufficient: false,
    usedAI,
  };
}
