import {
  compareRanked,
  hasPhrase,
  hoursMatch,
  parsePlaceSentence,
  parseWindow,
  scorePlaceRecord,
  type ScoreablePlace,
} from "./score.js";

function assert(condition: unknown, message: string) {
  if (!condition) throw new Error(message);
}

const PIN = { lat: 40.7831, lon: -73.9712 };

function place(partial: Partial<ScoreablePlace> & Pick<ScoreablePlace, "id" | "title">): ScoreablePlace {
  return {
    category: "community-garden",
    lat: 40.784,
    lon: -73.97,
    cost: "unknown",
    hours: null,
    tags: [],
    ...partial,
  };
}

function testEmptySentence() {
  const query = parsePlaceSentence("");
  assert(query.interests.length === 0, "empty sentence must not invent interests");
  assert(query.costFilter === "any", "empty sentence must not assume free");
  assert(query.requestedTime == null, "empty sentence must not assume a time window");
  assert(!query.nearbyMentioned, "empty sentence must not assume nearby");
}

function testFreeGardenNearby() {
  const query = parsePlaceSentence("free garden nearby");
  assert(query.interests.includes("gardens"), "garden should map to gardens");
  assert(query.costFilter === "free", "free should set free-only");
  assert(query.nearbyMentioned, "nearby should be noted");
  assert(query.requestedTime == null, "nearby is not a clock window");
}

function testMarketSunday() {
  const query = parsePlaceSentence("market Sunday", new Date("2026-09-25T16:00:00.000Z"));
  assert(query.interests.includes("markets"), "market should map to markets");
  assert(query.requestedTime?.days.length === 1 && query.requestedTime.days[0] === 0, "Sunday is day 0");
  assert(!query.requestedTime?.days.includes(6), "Sunday must not be treated as Saturday");
}

function testWholeWords() {
  assert(!hasPhrase("part of the park", "art"), "art must not match part");
  assert(hasPhrase("public art nearby", "art"), "art should match as a word");
  const query = parsePlaceSentence("I like this part of Queens");
  assert(!query.interests.includes("art"), "part must not become an art interest");
}

function testWeekendAndSaturday() {
  const saturday = parseWindow("Saturday", new Date("2026-09-25T16:00:00.000Z"));
  const sunday = parseWindow("Sunday", new Date("2026-09-25T16:00:00.000Z"));
  const weekend = parseWindow("weekend", new Date("2026-09-25T16:00:00.000Z"));
  assert(saturday?.days.join() === "6", "Saturday means Saturday");
  assert(sunday?.days.join() === "0", "Sunday means Sunday");
  assert(weekend?.days.includes(6) && weekend.days.includes(0), "weekend covers Sat and Sun");
}

function testTonightAfterTen() {
  // 11:30 p.m. America/New_York on 26 Sep 2026 (EDT).
  const late = new Date("2026-09-27T03:30:00.000Z");
  const window = parseWindow("tonight", late);
  assert(window != null, "tonight should still parse after 10 p.m.");
  assert((window?.startMin ?? 0) >= 22 * 60, "after 10 p.m., tonight starts at the remaining hour");
  assert((window?.endMin ?? 0) > 24 * 60, "remaining tonight may run past midnight, not an elapsed 6–10 p.m. window");
}

function testPaidExcludedWhenFreeOnly() {
  const restaurant = place({
    id: "paid-1",
    title: "Paid Kitchen",
    category: "restaurant",
    cost: "paid",
  });
  const ranked = scorePlaceRecord(restaurant, {
    ...PIN,
    interests: ["food"],
    maxWalkMinutes: 20,
    costFilter: "free",
    requestedTime: null,
  });
  assert(ranked.excluded, "verified paid place must be excluded for free only");
}

function testMissingHoursNotExcluded() {
  const garden = place({
    id: "garden-no-hours",
    title: "Unposted Garden",
    hours: null,
  });
  const ranked = scorePlaceRecord(garden, {
    ...PIN,
    interests: ["gardens"],
    maxWalkMinutes: 20,
    costFilter: "any",
    requestedTime: {
      label: "Sunday",
      days: [0],
      startMin: 0,
      endMin: 1440,
    },
  });
  assert(!ranked.excluded, "missing hours must not exclude the record");
  assert(ranked.hoursStatus === "unknown", "missing hours stay unknown");
  assert(
    !ranked.factors.some((factor) => factor.id === "hours"),
    "unknown hours must be omitted from the average",
  );
}

function testMissingShadeOmitted() {
  const ranked = scorePlaceRecord(place({ id: "g1", title: "Garden" }), {
    ...PIN,
    interests: [],
    maxWalkMinutes: 20,
    costFilter: "any",
    requestedTime: null,
  });
  assert(
    ranked.omittedFactors.some((factor) => factor.id === "shade"),
    "shade must be listed as unknown / omitted",
  );
  assert(
    !ranked.factors.some((factor) => factor.id === "shade"),
    "shade must not be scored",
  );
}

function testEqualScoreTieBreak() {
  const a = {
    recommendationScore: 80,
    estimatedWalkMinutes: 10,
    title: "Beta Garden",
    id: "b",
  };
  const b = {
    recommendationScore: 80,
    estimatedWalkMinutes: 10,
    title: "Alpha Garden",
    id: "a",
  };
  const sorted = [a, b].sort(compareRanked);
  assert(sorted[0].title === "Alpha Garden", "equal scores break ties by title then id");
}

function testHoursOverlapAndUnknownParse() {
  const match = hoursMatch(
    {
      source: "market-listed",
      byDay: {
        0: { raw: "8am-3pm", ranges: [{ startMin: 8 * 60, endMin: 15 * 60 }] },
      },
    },
    { label: "Sunday", days: [0], startMin: 0, endMin: 1440 },
  );
  assert(match.status === "matches", "Sunday market hours should overlap an all-day Sunday request");

  const dawn = hoursMatch(
    {
      source: "pops-required",
      byDay: {
        0: { raw: "Dawn to dusk", ranges: null },
      },
    },
    { label: "Sunday", days: [0], startMin: 0, endMin: 1440 },
  );
  assert(dawn.status === "unknown", "unparseable hours stay unknown");
}

function testScoreClampAndEmptyFactors() {
  const ranked = scorePlaceRecord(place({ id: "far", title: "Far", lat: 40.9, lon: -74.2 }), {
    ...PIN,
    interests: [],
    maxWalkMinutes: 5,
    costFilter: "any",
    requestedTime: null,
  });
  assert(ranked.recommendationScore >= 0 && ranked.recommendationScore <= 100, "score stays 0–100");
}

testEmptySentence();
testFreeGardenNearby();
testMarketSunday();
testWholeWords();
testWeekendAndSaturday();
testTonightAfterTen();
testPaidExcludedWhenFreeOnly();
testMissingHoursNotExcluded();
testMissingShadeOmitted();
testEqualScoreTieBreak();
testHoursOverlapAndUnknownParse();
testScoreClampAndEmptyFactors();
console.log("score.check: sentence, windows, cost, hours, shade, ties OK");
