import type { Citation, PlaceProfile, PlaceSummary, StoryNode } from '@/types/api'

/**
 * Sample content for the three prototype fixtures.
 *
 * IMPORTANT: every name, narrative beat, and quoted "reason" below is
 * placeholder prototype copy for a DivHacks demo, not reviewed factual
 * content. `isSample: true` is threaded through every fixture and surfaced
 * in the UI so nothing here is mistaken for verified journalism, resident
 * testimony, or a real address. `coordinates` are `null` on every fixture
 * because no location has been verified for this build — the map always
 * renders its graceful fallback card until real, reviewed coordinates are
 * supplied for a real backend-reviewed place.
 */

/** Internal weight of a tag for a given fixture, used only by the mock matcher. */
export interface TagWeight {
  tag: string
  weight: number
}

export interface SampleAnswer {
  question: string
  answer: string
}

export interface PlaceFixture extends PlaceProfile {
  sampleAnswers: SampleAnswer[]
}

const emptyCitations: Citation[] = []

// ---------------------------------------------------------------------------
// Fixture 1 — calm, green, unhurried
// ---------------------------------------------------------------------------

const gardenStory: StoryNode[] = [
  {
    id: 'garden-intro',
    kind: 'intro',
    text: "Past a low iron gate, a narrow garden opens up behind the block — the kind of in-between space you'd only find by wandering. Regulars nod to each other over paperbacks. The street noise fades within a few steps, replaced by rustling leaves and the occasional page turning.",
    illustration: 'garden',
    question: 'What catches your eye?',
    choices: [
      { id: 'garden-choice-bench', label: 'The reading benches', nextNodeId: 'garden-branch-bench' },
      { id: 'garden-choice-corner', label: 'The tucked-away corner', nextNodeId: 'garden-branch-corner' },
    ],
    citationIds: [],
  },
  {
    id: 'garden-branch-bench',
    kind: 'branch',
    text: 'A cluster of mismatched benches sits under a canopy that filters the light into moving patterns. Someone has left a small stack of paperbacks on a ledge with a handwritten "take one, leave one" sign, half-faded from weather.',
    illustration: 'garden',
    choices: [{ id: 'garden-continue-bench', label: 'Continue the story', nextNodeId: 'garden-closing' }],
    citationIds: [],
  },
  {
    id: 'garden-branch-corner',
    kind: 'branch',
    text: 'Tucked in the far corner, a tiny reading nook is wedged between two planters taller than a person. It only fits two or three people at once, which seems to be the point — a deliberately small-scale pause built into a very large city.',
    illustration: 'garden',
    choices: [{ id: 'garden-continue-corner', label: 'Continue the story', nextNodeId: 'garden-closing' }],
    citationIds: [],
  },
  {
    id: 'garden-closing',
    kind: 'closing',
    text: "Gardens like this one exist because someone, at some point, fought to keep a small unbuilt lot from becoming another building. That history of persistence is part of what makes the quiet feel earned rather than incidental — a pocket held onto on purpose.",
    illustration: 'garden',
    location: { coordinates: null, verified: false },
    citationIds: [],
  },
]

export const gardenFixture: PlaceFixture = {
  id: 'quietwood-garden',
  name: 'Quietwood Garden Pocket',
  neighborhood: 'Sample pocket (placeholder)',
  borough: 'Manhattan (placeholder)',
  coordinates: null,
  illustration: 'garden',
  imageAttribution: 'Original illustration for this prototype — not a photograph of a real location.',
  description:
    'A small, gated community garden squeezed between buildings, favored by people who read, sketch, or just sit. Sample profile for this prototype — not yet reviewed for factual accuracy.',
  differenceNote:
    "Unlike a quiet garden you might picture in a smaller town, this one is scaled to a city block and stays open only during set hours, maintained entirely by volunteers who treat access as a shared privilege rather than a given.",
  entryNodeId: 'garden-intro',
  storyNodes: gardenStory,
  citations: emptyCitations,
  contentVersion: 'sample-v1',
  isSample: true,
  suggestedQuestions: [
    'Who takes care of a garden like this?',
    'Is a space like this ever open to everyone?',
  ],
  sampleAnswers: [
    {
      question: 'Who takes care of a garden like this?',
      answer:
        "In this sample story, upkeep is described as volunteer-run, with no paid staff — a detail written for this prototype and not yet checked against a verified source.",
    },
    {
      question: 'Is a space like this ever open to everyone?',
      answer:
        'This sample profile describes set opening hours rather than round-the-clock access, though the detail is illustrative only and has not been verified.',
    },
  ],
}

const gardenTags: TagWeight[] = [
  { tag: 'calm', weight: 1 },
  { tag: 'greenery', weight: 1 },
  { tag: 'reading', weight: 0.9 },
  { tag: 'linger', weight: 0.8 },
  { tag: 'waterfront', weight: 0.1 },
  { tag: 'lively', weight: 0.05 },
  { tag: 'evening-activity', weight: 0.1 },
  { tag: 'small-food-shops', weight: 0.1 },
  { tag: 'art', weight: 0.2 },
  { tag: 'independent-shops', weight: 0.1 },
]

// ---------------------------------------------------------------------------
// Fixture 2 — lively food-and-street pocket
// ---------------------------------------------------------------------------

const streetStory: StoryNode[] = [
  {
    id: 'street-intro',
    kind: 'intro',
    text: 'By early evening the block wakes up a second time. Folding tables edge onto the sidewalk, a bakery props its door open, and the smell of something frying drifts out past a line of people who clearly already know what they want.',
    illustration: 'street',
    question: 'What catches your eye?',
    choices: [
      { id: 'street-choice-counter', label: 'The counter shop', nextNodeId: 'street-branch-counter' },
      { id: 'street-choice-corner', label: 'The fruit stand corner', nextNodeId: 'street-branch-corner' },
    ],
    citationIds: [],
  },
  {
    id: 'street-branch-counter',
    kind: 'branch',
    text: "A narrow counter shop sells one thing well and has for years — no menu board needed, regulars just say a number. The owner works the register between orders, greeting most people by a nickname instead of a name.",
    illustration: 'street',
    choices: [{ id: 'street-continue-counter', label: 'Continue the story', nextNodeId: 'street-closing' }],
    citationIds: [],
  },
  {
    id: 'street-branch-corner',
    kind: 'branch',
    text: 'On the corner, a folding table sells fruit cut to order, lit by a single clamp lamp once the sun drops. Nobody is rushing the transaction — it doubles as the block\'s unofficial meeting point for the ten minutes after dinner.',
    illustration: 'street',
    choices: [{ id: 'street-continue-corner', label: 'Continue the story', nextNodeId: 'street-closing' }],
    citationIds: [],
  },
  {
    id: 'street-closing',
    kind: 'closing',
    text: 'Evening streets like this one run on relationships built over years, not turnover. That is part of why a two-minute walk here can feel like passing through several small, distinct rooms rather than one continuous commercial strip.',
    illustration: 'street',
    location: { coordinates: null, verified: false },
    citationIds: [],
  },
]

export const streetFixture: PlaceFixture = {
  id: 'lantern-row',
  name: 'Lantern Row',
  neighborhood: 'Sample pocket (placeholder)',
  borough: 'Queens (placeholder)',
  coordinates: null,
  illustration: 'street',
  imageAttribution: 'Original illustration for this prototype — not a photograph of a real location.',
  description:
    'A short evening food-and-street strip with small shops that stay open late. Sample profile for this prototype — not yet reviewed for factual accuracy.',
  differenceNote:
    'Unlike a single lively street you might already know, this strip is only a few storefronts long and only really turns on after dark — the daytime version of the same block feels almost residential.',
  entryNodeId: 'street-intro',
  storyNodes: streetStory,
  citations: emptyCitations,
  contentVersion: 'sample-v1',
  isSample: true,
  suggestedQuestions: [
    'Why do these shops mostly open in the evening?',
    'How did a strip like this end up so small?',
  ],
  sampleAnswers: [
    {
      question: 'Why do these shops mostly open in the evening?',
      answer:
        "The sample story attributes this to the block's daytime and evening businesses sharing the same storefronts — a placeholder explanation, not a verified fact.",
    },
    {
      question: 'How did a strip like this end up so small?',
      answer:
        'This prototype narrative suggests it simply never expanded past its original footprint, but that detail is illustrative only and unverified.',
    },
  ],
}

const streetTags: TagWeight[] = [
  { tag: 'lively', weight: 1 },
  { tag: 'small-food-shops', weight: 1 },
  { tag: 'evening-activity', weight: 0.9 },
  { tag: 'linger', weight: 0.5 },
  { tag: 'calm', weight: 0.05 },
  { tag: 'greenery', weight: 0.05 },
  { tag: 'reading', weight: 0.05 },
  { tag: 'art', weight: 0.2 },
  { tag: 'independent-shops', weight: 0.4 },
  { tag: 'waterfront', weight: 0.05 },
]

// ---------------------------------------------------------------------------
// Fixture 3 — art, independent shops, unexpected corners
// ---------------------------------------------------------------------------

const galleryStory: StoryNode[] = [
  {
    id: 'gallery-intro',
    kind: 'intro',
    text: 'The block looks unremarkable from the avenue — a hardware store, a shuttered garage door — until you notice the garage door is actually a gallery, open only on weekends, with no sign beyond a taped-up flyer.',
    illustration: 'gallery',
    question: 'What catches your eye?',
    choices: [
      { id: 'gallery-choice-storefront', label: 'The closet-sized shop', nextNodeId: 'gallery-branch-storefront' },
      { id: 'gallery-choice-alley', label: 'The mural alley', nextNodeId: 'gallery-branch-alley' },
    ],
    citationIds: [],
  },
  {
    id: 'gallery-branch-storefront',
    kind: 'branch',
    text: "Next door, a shop the size of a large closet stocks only work by artists who live within a few blocks. The owner will tell you which piece was made upstairs if you ask, and seems mildly delighted that you asked at all.",
    illustration: 'gallery',
    choices: [{ id: 'gallery-continue-storefront', label: 'Continue the story', nextNodeId: 'gallery-closing' }],
    citationIds: [],
  },
  {
    id: 'gallery-branch-alley',
    kind: 'branch',
    text: 'A narrow alley between two buildings has become an unofficial rotating mural wall — repainted every few months by whoever asks first. Half the current wall is already flaking, which nobody seems to mind.',
    illustration: 'gallery',
    choices: [{ id: 'gallery-continue-alley', label: 'Continue the story', nextNodeId: 'gallery-closing' }],
    citationIds: [],
  },
  {
    id: 'gallery-closing',
    kind: 'closing',
    text: 'Corners like this survive on cheap-enough rent and a handful of people willing to keep odd hours. It is a fragile arrangement, and part of what makes finding it feel like a small discovery rather than a listed destination.',
    illustration: 'gallery',
    location: { coordinates: null, verified: false },
    citationIds: [],
  },
]

export const galleryFixture: PlaceFixture = {
  id: 'flint-alley',
  name: 'Flint Alley Corner',
  neighborhood: 'Sample pocket (placeholder)',
  borough: 'Brooklyn (placeholder)',
  coordinates: null,
  illustration: 'gallery',
  imageAttribution: 'Original illustration for this prototype — not a photograph of a real location.',
  description:
    'An unassuming corner hiding a rotating gallery, an artist-run shop, and a mural alley. Sample profile for this prototype — not yet reviewed for factual accuracy.',
  differenceNote:
    'Unlike an established gallery district, almost nothing here is permanent — the mural repaints, the gallery keeps weekend-only hours, and half of what makes it interesting might look different in six months.',
  entryNodeId: 'gallery-intro',
  storyNodes: galleryStory,
  citations: emptyCitations,
  contentVersion: 'sample-v1',
  isSample: true,
  suggestedQuestions: [
    'How often does the mural wall actually change?',
    'Is the gallery ever open on weekdays?',
  ],
  sampleAnswers: [
    {
      question: 'How often does the mural wall actually change?',
      answer:
        "In this sample story the wall is repainted every few months by whoever asks first — an invented detail for this prototype, not a confirmed schedule.",
    },
    {
      question: 'Is the gallery ever open on weekdays?',
      answer:
        'The sample profile describes weekend-only hours, though this is placeholder content and has not been verified against a real source.',
    },
  ],
}

const galleryTags: TagWeight[] = [
  { tag: 'art', weight: 1 },
  { tag: 'independent-shops', weight: 1 },
  { tag: 'lively', weight: 0.3 },
  { tag: 'linger', weight: 0.5 },
  { tag: 'calm', weight: 0.15 },
  { tag: 'greenery', weight: 0.05 },
  { tag: 'reading', weight: 0.1 },
  { tag: 'small-food-shops', weight: 0.2 },
  { tag: 'evening-activity', weight: 0.2 },
  { tag: 'waterfront', weight: 0.1 },
]

export const PLACE_FIXTURES: PlaceFixture[] = [gardenFixture, streetFixture, galleryFixture]

export const FIXTURE_MATCH_TAGS: Record<string, TagWeight[]> = {
  [gardenFixture.id]: gardenTags,
  [streetFixture.id]: streetTags,
  [galleryFixture.id]: galleryTags,
}

export function toPlaceSummary(fixture: PlaceFixture): PlaceSummary {
  return {
    id: fixture.id,
    name: fixture.name,
    neighborhood: fixture.neighborhood,
    borough: fixture.borough,
    illustration: fixture.illustration,
    imageAttribution: fixture.imageAttribution,
    isSample: true,
  }
}

export function getFixtureById(placeId: string): PlaceFixture | undefined {
  return PLACE_FIXTURES.find((fixture) => fixture.id === placeId)
}
