import { useEffect, useId, useRef, useState, type ReactNode } from "react";
import { loadBootstrap, requestAsk, requestEvents, requestMatch } from "./api";
import Landing, { SparkleField } from "./Landing";
import NearbyDiscovery from "./NearbyDiscovery";
import CitywideExplore from "./CitywideExplore";
import QuestionnaireForm, { type QuestionnaireAnswers } from "./Questionnaire";
import VisitKit from "./VisitKit";
import type {
  AskResult,
  Bootstrap,
  CityEventsResult,
  DimensionId,
  MatchResult,
  PermittedEventRecord,
  Screen,
  StoryChoice,
} from "./types";

const FLOW_STEPS = [
  { id: "welcome", label: "What you miss" },
  { id: "match", label: "Here" },
  { id: "story", label: "Its own story" },
  { id: "challenge", label: "On the ground" },
  { id: "reflect", label: "Your note" },
] as const;

const REFLECTION_KEY = "elsewhere-here:private-reflection";

type PrivateReflection = {
  neighborhoodId: string;
  neighborhoodName: string;
  memory: string;
  text: string;
  savedAt: string;
};

function loadReflection(): PrivateReflection | null {
  try {
    const raw = localStorage.getItem(REFLECTION_KEY);
    if (!raw) return null;
    return JSON.parse(raw) as PrivateReflection;
  } catch {
    return null;
  }
}

function saveReflection(entry: PrivateReflection) {
  localStorage.setItem(REFLECTION_KEY, JSON.stringify(entry));
}

export default function App() {
  const [boot, setBoot] = useState<Bootstrap | null>(null);
  const [bootError, setBootError] = useState<string | null>(null);
  const [screen, setScreen] = useState<Screen>("landing");
  const [match, setMatch] = useState<MatchResult | null>(null);
  const [memory, setMemory] = useState("");
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [choice, setChoice] = useState<StoryChoice | null>(null);
  const [weights, setWeights] = useState<Partial<Record<DimensionId, number>>>({});
  const [question, setQuestion] = useState("");
  const [ask, setAsk] = useState<AskResult | null>(null);
  const [askReturn, setAskReturn] = useState<Screen>("match");
  const [fromLanding, setFromLanding] = useState(false);

  useEffect(() => {
    loadBootstrap()
      .then(setBoot)
      .catch((e: Error) => setBootError(e.message));
  }, []);

  async function handleAnswers(answers: QuestionnaireAnswers) {
    setError(null);
    setBusy(true);
    try {
      const result = await requestMatch(answers);
      setMemory([answers.place, answers.memory].filter(Boolean).join(" — "));
      setWeights(answers.weights ?? {});
      setMatch(result);
      setChoice(null);
      setAsk(null);
      setQuestion("");
      setScreen("match");
    } catch (e) {
      setError(e instanceof Error ? e.message : "Could not find a match.");
    } finally {
      setBusy(false);
    }
  }

  function startOver() {
    setScreen("welcome");
    setMatch(null);
    setChoice(null);
    setAsk(null);
    setError(null);
    setQuestion("");
    setMemory("");
    setFromLanding(false);
  }

  const view =
    screen === "landing" ? (
      <Landing
        onBegin={() => {
          setFromLanding(true);
          setScreen("welcome");
        }}
        ready={Boolean(boot) && !bootError}
        error={bootError}
      />
    ) : bootError ? (
      <Shell>
        <p className="error" role="alert">
          Could not load the app. Try again in a moment.
        </p>
      </Shell>
    ) : !boot ? (
      <Shell>
        <p className="muted" aria-live="polite">
          Loading…
        </p>
      </Shell>
    ) : null;

  const story = boot && match ? boot.stories[match.neighborhoodId] : undefined;
  const sources =
    boot && match
      ? boot.sourceIndex.filter((s) => s.neighborhoodId === match.neighborhoodId)
      : [];
  const neighborhood =
    boot && match
      ? boot.neighborhoods.find((n) => n.id === match.neighborhoodId)
      : undefined;

  const content = view ?? (
      <Shell
        screen={screen}
        fromLanding={fromLanding && screen === "welcome"}
        onHome={screen === "welcome" ? undefined : startOver}
      >
      {screen === "welcome" && (
        <Welcome
            examples={boot?.examples ?? []}
          busy={busy}
          error={error}
          onSubmit={handleAnswers}
          onCitywide={() => setScreen("citywide")}
          enter={fromLanding}
        />
      )}
      {screen === "citywide" && <CitywideExplore />}
      {screen === "match" && match && (
        <MatchView
          match={match}
          memory={memory}
          weights={weights}
          latitude={neighborhood?.latitude}
          longitude={neighborhood?.longitude}
          onStory={() => setScreen("story")}
          onAsk={() => {
            setAskReturn("match");
            setScreen("ask");
          }}
        />
      )}
      {screen === "story" && match && story && (
        <StoryView
          match={match}
          story={story}
          sources={sources}
          choice={choice}
          onChoose={setChoice}
          onResetChoice={() => setChoice(null)}
          onChallenge={() => setScreen("challenge")}
          onBack={() => setScreen("match")}
        />
      )}
      {screen === "challenge" && match && story && (
        <ChallengeView
          match={match}
          closingQuestion={story.closingQuestion}
          explorePrompt={neighborhood?.explorePrompt}
          latitude={neighborhood?.latitude}
          longitude={neighborhood?.longitude}
          onReflect={() => setScreen("reflect")}
          onBack={() => setScreen("story")}
        />
      )}
      {screen === "reflect" && match && (
        <ReflectView
          match={match}
          memory={memory}
          onBack={() => setScreen("challenge")}
          onAsk={() => {
            setAskReturn("reflect");
            setScreen("ask");
          }}
        />
      )}
      {screen === "ask" && match && (
        <AskView
          match={match}
          closingQuestion={story?.closingQuestion}
          question={question}
          setQuestion={setQuestion}
          ask={ask}
          setAsk={setAsk}
          busy={busy}
          setBusy={setBusy}
          error={error}
          setError={setError}
          onBack={() => setScreen(askReturn)}
        />
      )}
    </Shell>
  );

  return (
    <>
      <SparkleField />
      {content}
    </>
  );
}

function Shell({
  children,
  onHome,
  screen = "welcome",
  fromLanding = false,
}: {
  children: ReactNode;
  onHome?: () => void;
  screen?: Screen;
  fromLanding?: boolean;
}) {
  const stepId =
    screen === "ask"
      ? "reflect"
      : screen === "citywide"
        ? "welcome"
        : screen;
  return (
    <div className={fromLanding ? "page page-from-landing" : "page"}>
      <header className="top">
        <p className="eyebrow">Know Your City</p>
        {onHome ? (
          <button type="button" className="wordmark as-button" onClick={onHome}>
            Elsewhere, Here
          </button>
        ) : (
          <h1 className="wordmark">Elsewhere, Here</h1>
        )}
        <ol className="flow" aria-label="Visit path">
          {FLOW_STEPS.map((step) => (
            <li
              key={step.id}
              className={step.id === stepId ? "current" : undefined}
            >
              {step.label}
            </li>
          ))}
        </ol>
      </header>
      <main>{children}</main>
      <footer>
        <p>
          {screen === "citywide"
            ? "City records are a separate Open Data path. Neighborhood matches are only Jackson Heights, Red Hook, and Inwood."
            : "Describe a place you miss. We look for a likeness of feeling in three NYC neighborhoods—not a copy of that place."}
        </p>
      </footer>
    </div>
  );
}

function Welcome({
  examples,
  busy,
  error,
  onSubmit,
  onCitywide,
  enter = false,
}: {
  examples: Bootstrap["examples"];
  busy: boolean;
  error: string | null;
  onSubmit: (answers: QuestionnaireAnswers) => void;
  onCitywide: () => void;
  enter?: boolean;
}) {
  const [phrase, setPhrase] = useState("");
  const [fineTune, setFineTune] = useState(false);
  const phraseId = useId();

  function submitPhrase(text: string) {
    const trimmed = text.trim();
    if (!trimmed) return;
    onSubmit({ place: trimmed, memory: trimmed });
  }

  if (fineTune) {
    return (
      <section className="stack">
        <p className="kicker">Optional</p>
        <h2>Fine-tune my match</h2>
        <p className="lede">
          Sliders and priorities stay here. The short phrase on the last screen
          already works on its own.
        </p>
        <div className="actions">
          <button type="button" className="ghost" onClick={() => setFineTune(false)}>
            Back to “What place do you miss?”
          </button>
        </div>
        <QuestionnaireForm
          examples={examples}
          busy={busy}
          serverError={error}
          seedPhrase={phrase}
          onSubmit={onSubmit}
        />
      </section>
    );
  }

  return (
    <section className={enter ? "stack welcome-night welcome-enter" : "stack welcome-night"}>
      <p className="kicker">After dark</p>
      <h2>What place do you miss?</h2>
      <p className="lede">
        Name it the way you’d say it at 1 a.m. A few words are enough. We look
        for an NYC neighborhood that rhymes with that feeling—not a replica,
        and only among Jackson Heights, Red Hook, and Inwood.
      </p>
      <form
        className="stack welcome-form"
        onSubmit={(event) => {
          event.preventDefault();
          submitPhrase(phrase);
        }}
      >
        <label htmlFor={phraseId} className="prompt-label">
          The place, in your words
        </label>
        <input
          id={phraseId}
          className="welcome-input"
          type="text"
          value={phrase}
          disabled={busy}
          autoComplete="off"
          placeholder="A late kitchen, a hillside after dinner, a slow port…"
          onChange={(event) => setPhrase(event.target.value)}
        />
        {examples.length > 0 && (
          <fieldset className="examples">
            <legend>Or start from a night like this</legend>
            <div className="chips">
              {examples.map((ex) => (
                <button
                  key={ex.id}
                  type="button"
                  className="chip"
                  disabled={busy}
                  onClick={() => {
                    setPhrase(ex.text);
                    submitPhrase(ex.text);
                  }}
                >
                  {ex.label}
                </button>
              ))}
            </div>
          </fieldset>
        )}
        {error && (
          <p className="error" role="alert">
            {error}
          </p>
        )}
        <div className="actions">
          <button type="submit" className="primary" disabled={busy || !phrase.trim()}>
            {busy ? "Looking…" : "Find a neighborhood"}
          </button>
          <button
            type="button"
            className="ghost"
            disabled={busy}
            onClick={() => setFineTune(true)}
          >
            Fine-tune my match
          </button>
          <button
            type="button"
            className="ghost"
            disabled={busy}
            onClick={onCitywide}
          >
            Rank city records near a pin
          </button>
        </div>
      </form>
    </section>
  );
}

function MatchView({
  match,
  memory,
  weights,
  latitude,
  longitude,
  onStory,
  onAsk,
}: {
  match: MatchResult;
  memory: string;
  weights: Partial<Record<DimensionId, number>>;
  latitude?: number;
  longitude?: number;
  onStory: () => void;
  onAsk: () => void;
}) {
  const [ownOpen, setOwnOpen] = useState(false);
  const reason = match.reasons[0] ?? match.shortLine;
  const visit = match.visitHere;

  return (
    <article className="stack">
      <p className="kicker">A likeness of feeling · {match.borough}</p>
      <div className="reveal">
        <div className="reveal-panel">
          <p className="kicker">You miss</p>
          <h2 className="reveal-heading">That place</h2>
          <p className="passage">{memory || "A place you described."}</p>
        </div>
        <div className="reveal-panel reveal-here">
          <p className="kicker">In New York</p>
          <h2 className="reveal-heading">{match.name}</h2>
          <p>{match.shortLine}</p>
          <figure className="hero">
            <img src={match.photo.src} alt={match.photo.alt} />
            <figcaption>
              <a href={match.photo.creditUrl} target="_blank" rel="noreferrer">
                {match.photo.credit}
              </a>
            </figcaption>
          </figure>
        </div>
      </div>
      <p className="note">{reason}</p>
      <p className="muted">{match.interpretationNote}</p>

      <div className="actions">
        <button
          type="button"
          className="primary"
          aria-expanded={ownOpen}
          onClick={() => setOwnOpen((open) => !open)}
        >
          But what makes this place its own?
        </button>
      </div>
      {ownOpen && (
        <div className="own-story" role="region" aria-label="What makes this neighborhood distinct">
          <p>{match.difference}</p>
          <p className="muted">
            This is not the same as the place you miss, and it is not a stand-in
            for another culture.
          </p>
          {match.differenceSource && (
            <p>
              <a href={match.differenceSource.url} target="_blank" rel="noreferrer">
                Source: {match.differenceSource.title}
              </a>
            </p>
          )}
        </div>
      )}

      <section className="stack visit-here">
        <h3>One place to stand in {match.name}</h3>
        <p>
          <strong>{visit.title}.</strong> {visit.do}
        </p>
        {visit.lookFor && <p className="look">Look for: {visit.lookFor}</p>}
        <div className="actions">
          <a
            className="ghost"
            href={`https://www.openstreetmap.org/?mlat=${visit.lat}&mlon=${visit.lon}#map=16/${visit.lat}/${visit.lon}`}
            target="_blank"
            rel="noreferrer"
          >
            Map
          </a>
          <button type="button" className="primary" onClick={onStory}>
            Continue into the streets of {match.name}
          </button>
        </div>
      </section>

      <NearbyDiscovery
        sectionId="match-nearby"
        heading="A city record near this neighborhood"
        neighborhood={match.name}
        borough={match.borough}
        neighborhoodLat={latitude}
        neighborhoodLon={longitude}
      />

      <div className="actions">
        <button type="button" className="ghost" onClick={onAsk}>
          Ask a sourced question
        </button>
      </div>
      <details>
        <summary>More notes for this neighborhood</summary>
        <VisitKit
          name={match.name}
          borough={match.borough}
          guide={match.visitGuide}
          weights={weights}
        />
        <CityRecords borough={match.borough} />
      </details>
    </article>
  );
}

function formatEventWhen(iso: string): string {
  const date = new Date(iso);
  if (Number.isNaN(date.getTime())) return iso;
  return date.toLocaleString(undefined, {
    weekday: "short",
    month: "short",
    day: "numeric",
    hour: "numeric",
    minute: "2-digit",
  });
}

function isParkSportPermit(row: PermittedEventRecord): boolean {
  const type = (row.eventType ?? "").toLowerCase();
  return type.includes("sport");
}

function CityRecords({ borough }: { borough: string }) {
  const [data, setData] = useState<CityEventsResult | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    let cancelled = false;
    setLoading(true);
    setError(null);
    requestEvents(borough)
      .then((payload) => {
        if (!cancelled) setData(payload);
      })
      .catch((e: Error) => {
        if (!cancelled) {
          setData(null);
          setError(e.message);
        }
      })
      .finally(() => {
        if (!cancelled) setLoading(false);
      });
    return () => {
      cancelled = true;
    };
  }, [borough]);

  const streetLife =
    data?.records.filter((row) => !isParkSportPermit(row)) ?? [];
  const sports = data?.records.filter(isParkSportPermit) ?? [];
  const shown = streetLife.length > 0 ? streetLife : sports.slice(0, 5);

  return (
    <details className="city-records">
      <summary>
        This week in {borough}
        {data ? ` · ${data.records.length} city permits` : ""}
      </summary>
      <p className="muted">
        Official permitted-event records for the whole borough. We hide routine
        park sports when there is anything else, so you can see street closures
        and special events that might affect a visit.
      </p>
      {loading && <p className="muted">Loading borough records…</p>}
      {error && (
        <p className="error" role="alert">
          {error}
        </p>
      )}
      {data && (
        <>
          <p className="muted">{data.disclaimer}</p>
          {shown.length === 0 ? (
            <p className="muted">
              No permitted-event records in the next seven days for this borough.
            </p>
          ) : (
            <ul className="records">
              {shown.map((row) => (
                <li key={row.eventId + row.startDateTime}>
                  <strong>{row.name}</strong>
                  <span className="muted">
                    {formatEventWhen(row.startDateTime)}
                    {row.eventType ? ` · ${row.eventType}` : ""}
                    {row.location ? ` · ${row.location}` : ""}
                  </span>
                </li>
              ))}
            </ul>
          )}
          {streetLife.length > 0 && sports.length > 0 && (
            <p className="muted">
              {sports.length} additional park-sport permits are in the same
              borough feed and are omitted here.
            </p>
          )}
        </>
      )}
    </details>
  );
}

function StoryView({
  match,
  story,
  sources,
  choice,
  onChoose,
  onResetChoice,
  onChallenge,
  onBack,
}: {
  match: MatchResult;
  story: Bootstrap["stories"][string];
  sources: Bootstrap["sourceIndex"];
  choice: StoryChoice | null;
  onChoose: (c: StoryChoice) => void;
  onResetChoice: () => void;
  onChallenge: () => void;
  onBack: () => void;
}) {
  const headingRef = useRef<HTMLHeadingElement>(null);
  useEffect(() => {
    headingRef.current?.focus();
  }, [choice?.id]);

  return (
    <article className="stack story">
      <p className="kicker">
        Attributed local account · {match.name}
      </p>
      <h2 ref={headingRef} tabIndex={-1}>
        {choice ? "A closer look" : "On the ground"}
      </h2>
      <p className="muted">
        This is an editorial walk compiled from public sources about {match.name},
        not a quoted resident interview.
      </p>
      <figure className="hero">
        <img src={story.start.visual} alt={story.start.visualAlt} />
        <figcaption>
          <a href={match.photo.creditUrl} target="_blank" rel="noreferrer">
            {match.photo.credit}
          </a>
        </figcaption>
      </figure>
      {!choice ? (
        <>
          <p className="passage">{story.start.passage}</p>
          <p className="prompt-label">Where do you go?</p>
          <div className="actions column">
            {story.start.choices.map((c) => (
              <button
                key={c.id}
                type="button"
                className="choice"
                onClick={() => onChoose(c)}
              >
                {c.label}
              </button>
            ))}
          </div>
        </>
      ) : (
        <>
          <p className="passage">{choice.reveal}</p>
          {sources.length > 0 && (
            <>
              <h3>Sources for this account</h3>
              <ul className="sources">
                {sources.map((s) => (
                  <li key={s.id}>
                    <a href={s.url} target="_blank" rel="noreferrer">
                      {s.title}
                    </a>
                    <span className="url">{s.url}</span>
                  </li>
                ))}
              </ul>
            </>
          )}
          <div className="actions">
            <button type="button" className="primary" onClick={onChallenge}>
              Take this walk on the ground
            </button>
            <button type="button" className="ghost" onClick={onResetChoice}>
              Choose the other path
            </button>
          </div>
          <p>
            <button type="button" className="text-link" onClick={onBack}>
              Back to the match
            </button>
          </p>
        </>
      )}
      {!choice && sources.length > 0 && (
        <p className="muted">
          After you choose a path, the account is attributed to the sources listed
          for {match.name}.
        </p>
      )}
    </article>
  );
}

function ChallengeView({
  match,
  closingQuestion,
  explorePrompt,
  latitude,
  longitude,
  onReflect,
  onBack,
}: {
  match: MatchResult;
  closingQuestion: string;
  explorePrompt?: string;
  latitude?: number;
  longitude?: number;
  onReflect: () => void;
  onBack: () => void;
}) {
  return (
    <section className="stack">
      <p className="kicker">On the ground · {match.name}</p>
      <h2>You are there. Use the visit, then notice what the plan did not list</h2>
      <p>
        Follow the walk you saved. Then look for one thing specific to {match.name},{" "}
        {match.borough}—not a copy of the place you described at the start.
      </p>
      <p className="explore">
        <strong>When you are there, ask:</strong> {closingQuestion}
      </p>
      {explorePrompt && (
        <p>
          <strong>A sharper look:</strong> {explorePrompt}
        </p>
      )}
      <p className="muted">
        This is not a scavenger hunt of attractions. It is a prompt to observe
        streets, parks, or buildings that the sources actually document. The
        art records below are city inventory rows, not a second neighborhood match.
      </p>
      <NearbyDiscovery
        heading="City public-art inventory near this walk"
        neighborhood={match.name}
        borough={match.borough}
        neighborhoodLat={latitude}
        neighborhoodLon={longitude}
      />
      <div className="actions">
        <button type="button" className="primary" onClick={onReflect}>
          Keep a private note
        </button>
        <button type="button" className="ghost" onClick={onBack}>
          Back to the account
        </button>
      </div>
    </section>
  );
}

function ReflectView({
  match,
  memory,
  onBack,
  onAsk,
}: {
  match: MatchResult;
  memory: string;
  onBack: () => void;
  onAsk: () => void;
}) {
  const id = useId();
  const existing = loadReflection();
  const [text, setText] = useState(
    existing?.neighborhoodId === match.neighborhoodId ? existing.text : "",
  );
  const [saved, setSaved] = useState<PrivateReflection | null>(
    existing?.neighborhoodId === match.neighborhoodId ? existing : null,
  );

  function persist() {
    const entry: PrivateReflection = {
      neighborhoodId: match.neighborhoodId,
      neighborhoodName: match.name,
      memory,
      text: text.trim(),
      savedAt: new Date().toISOString(),
    };
    saveReflection(entry);
    setSaved(entry);
  }

  return (
    <section className="stack">
      <p className="kicker">Private reflection · {match.name}</p>
      <h2>Keep a note that stays on this device</h2>
      <p>
        Write what you noticed, or what you still want to check on the ground.
        This is not uploaded, not used to score neighborhoods, and not treated
        as a local fact.
      </p>
      {memory && (
        <p className="muted">Your memory at the start: {memory}</p>
      )}
      <label htmlFor={id} className="prompt-label">
        Your reflection
      </label>
      <textarea
        id={id}
        className="memory"
        rows={6}
        value={text}
        onChange={(e) => setText(e.target.value)}
        placeholder="What I expected from my memory, and what this neighborhood is instead…"
      />
      <div className="actions">
        <button type="button" className="primary" onClick={persist} disabled={!text.trim()}>
          Save on this device
        </button>
        <button type="button" className="ghost" onClick={onAsk}>
          Ask a sourced question
        </button>
      </div>
      {saved && (
        <p className="note" role="status">
          Saved privately at {new Date(saved.savedAt).toLocaleString()}. Only
          this browser can read it.
        </p>
      )}
      <p>
        <button type="button" className="text-link" onClick={onBack}>
          Back to the observation challenge
        </button>
      </p>
    </section>
  );
}

function AskView({
  match,
  closingQuestion,
  question,
  setQuestion,
  ask,
  setAsk,
  busy,
  setBusy,
  error,
  setError,
  onBack,
}: {
  match: MatchResult;
  closingQuestion?: string;
  question: string;
  setQuestion: (v: string) => void;
  ask: AskResult | null;
  setAsk: (v: AskResult | null) => void;
  busy: boolean;
  setBusy: (v: boolean) => void;
  error: string | null;
  setError: (v: string | null) => void;
  onBack: () => void;
}) {
  const id = useId();

  async function submit() {
    setError(null);
    setBusy(true);
    try {
      const result = await requestAsk(match.neighborhoodId, question);
      setAsk(result);
    } catch (e) {
      setError(e instanceof Error ? e.message : "Could not answer.");
    } finally {
      setBusy(false);
    }
  }

  return (
    <section className="stack">
      <p className="kicker">Sourced answers · {match.name}</p>
      <h2>Ask about this place</h2>
      <p>
        Answers come only from curated passages about {match.name}. Use this
        for history and what is documented—not for live train times. Transit
        is on the visit card.
      </p>
      <form
        className="stack"
        onSubmit={(e) => {
          e.preventDefault();
          void submit();
        }}
      >
        <label htmlFor={id} className="prompt-label">
          Your question
        </label>
        <textarea
          id={id}
          rows={4}
          value={question}
          onChange={(e) => setQuestion(e.target.value)}
          disabled={busy}
          required
          minLength={8}
          placeholder={closingQuestion ?? "What is documented about this place?"}
        />
        {closingQuestion && (
          <button
            type="button"
            className="chip"
            disabled={busy}
            onClick={() => setQuestion(closingQuestion)}
          >
            Use the story’s question
          </button>
        )}
        <div className="chips">
          {[
            `What is public space in ${match.name}, and what is private?`,
            `What should a visitor notice in ${match.name} that is not a typical tourist attraction?`,
            `How is ${match.name} different from a generic waterfront or market street?`,
          ].map((preset) => (
            <button
              key={preset}
              type="button"
              className="chip"
              disabled={busy}
              onClick={() => setQuestion(preset)}
            >
              {preset.length > 56 ? `${preset.slice(0, 52)}…` : preset}
            </button>
          ))}
        </div>
        {error && (
          <p className="error" role="alert">
            {error}
          </p>
        )}
        <button type="submit" className="primary" disabled={busy}>
          {busy ? "Searching sources…" : "Ask"}
        </button>
      </form>
      {ask && (
        <div
          className={ask.insufficient ? "answer warn" : "answer"}
          aria-live="polite"
        >
          <p>{ask.answer}</p>
          {ask.citations.length > 0 && (
            <>
              <h3>Sources</h3>
              <ul className="sources">
                {ask.citations.map((c) => (
                  <li key={c.sourceId}>
                    <a href={c.url} target="_blank" rel="noreferrer">
                      {c.title}
                    </a>
                    <span className="url">{c.url}</span>
                  </li>
                ))}
              </ul>
            </>
          )}
        </div>
      )}
      <p>
        <button type="button" className="text-link" onClick={onBack}>
          Back
        </button>
      </p>
    </section>
  );
}
