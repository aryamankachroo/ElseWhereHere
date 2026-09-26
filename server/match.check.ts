import { lexiconData } from "./data.js";
import { containsKeyword, matchDescription, tagsFromKeywords } from "./match.js";

const SAME_QUESTIONNAIRE = {
  preference: {
    energy: 3,
    food: 3,
    greenery: 3,
    arts: 3,
    gathering: 3,
    smallShops: 3,
  },
  weights: {
    energy: 0.5,
    food: 0.3,
    gathering: 0.2,
  },
};

function fail(message: string): never {
  throw new Error(message);
}

function assertEqual(actual: string, expected: string, label: string) {
  if (actual !== expected) fail(`${label}: expected ${expected}, got ${actual}`);
}

async function main() {
  const theater = "The theater seats were great for creating a treat afterward.";
  if (containsKeyword(theater, "eat")) {
    fail("substring 'eat' should not match inside great/theater/seats/creating/treat");
  }
  if (containsKeyword("The airport was busy at noon.", "port")) {
    fail("'port' should not match inside airport");
  }
  if (!containsKeyword("grilled food at the market", "food")) {
    fail("whole word 'food' should match");
  }
  if (tagsFromKeywords(theater).has("food-markets")) {
    fail("theater sentence should not tag food-markets via 'eat'");
  }

  const markets = lexiconData.examples.find((e) => e.id === "markets")!.text;
  const hill = lexiconData.examples.find((e) => e.id === "hill-park")!.text;
  const port = lexiconData.examples.find((e) => e.id === "port")!.text;

  const [marketMatch, hillMatch, portMatch, shortMarkets] = await Promise.all([
    matchDescription(markets, { ...SAME_QUESTIONNAIRE, memory: markets }),
    matchDescription(hill, { ...SAME_QUESTIONNAIRE, memory: hill }),
    matchDescription(port, { ...SAME_QUESTIONNAIRE, memory: port }),
    matchDescription("evening markets"),
  ]);

  assertEqual(marketMatch.neighborhoodId, "jackson-heights", "markets description");
  assertEqual(hillMatch.neighborhoodId, "inwood", "hill-park description");
  assertEqual(portMatch.neighborhoodId, "red-hook", "port description");
  assertEqual(shortMarkets.neighborhoodId, "jackson-heights", "short evening markets phrase");

  if (marketMatch.neighborhoodId === hillMatch.neighborhoodId) {
    fail("contrasting descriptions should not share a neighborhood under the same questionnaire");
  }

  if (!marketMatch.matchedQualities.some((q) => q.tag === "food-markets" || q.tag === "food")) {
    fail("Jackson Heights match should surface food-related input qualities");
  }
  if (!hillMatch.matchedQualities.some((q) => /park|forest|green|hilly|quiet/i.test(q.tag + q.label))) {
    fail("Inwood match should surface park/hill input qualities");
  }
  if (!portMatch.matchedQualities.some((q) => /water|maritime|warehouse|industrial|sky/i.test(q.tag + q.label))) {
    fail("Red Hook match should surface waterfront input qualities");
  }

  for (const result of [marketMatch, hillMatch, portMatch]) {
    if (!/3 curated neighborhoods/i.test(result.interpretationNote)) {
      fail("interpretation should state the three-neighborhood catalog limit");
    }
    if (/open data.*vibe/i.test(result.interpretationNote) && /measures vibe/i.test(result.interpretationNote)) {
      fail("should not claim Open Data measures vibe");
    }
  }

  let insufficient = false;
  try {
    await matchDescription("hello there!!");
  } catch (err) {
    const message = err instanceof Error ? err.message : "";
    insufficient = /need one more clue/i.test(message);
  }
  if (!insufficient) fail("empty evidence without ratings should ask for one more clue");

  console.log("match checks passed");
  console.log({
    markets: marketMatch.neighborhoodId,
    hill: hillMatch.neighborhoodId,
    port: portMatch.neighborhoodId,
    marketQualities: marketMatch.matchedQualities.map((q) => q.tag),
  });
}

void main();
