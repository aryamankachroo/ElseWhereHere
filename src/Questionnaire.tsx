import { useState, type FormEvent } from "react";
import type { Bootstrap, DimensionId } from "./types";

export const VIBE_DIMENSIONS = [
  { key: "energy", label: "Street energy", low: "Calm", high: "Bustling" },
  { key: "food", label: "Food scene", low: "Not prominent", high: "Everywhere" },
  { key: "greenery", label: "Greenery", low: "Mostly pavement", high: "Trees and parks" },
  { key: "arts", label: "Arts and music", low: "Rarely noticeable", high: "Highly visible" },
  { key: "gathering", label: "Social gathering", low: "People pass through", high: "People linger" },
  { key: "smallShops", label: "Small shops", low: "Few", high: "Many" },
] as const satisfies readonly {
  key: DimensionId;
  label: string;
  low: string;
  high: string;
}[];

const PRIORITY_WEIGHTS = [0.5, 0.3, 0.2] as const;
const PRIORITY_LABELS = ["Most important", "Second", "Third"] as const;

const EXAMPLE_PRESETS: Record<
  string,
  { ratings: Record<DimensionId, number>; priorities: [DimensionId, DimensionId, DimensionId] }
> = {
  markets: {
    ratings: {
      energy: 4,
      food: 4,
      greenery: 1,
      arts: 2,
      gathering: 4,
      smallShops: 4,
    },
    priorities: ["energy", "food", "smallShops"],
  },
  "hill-park": {
    ratings: {
      energy: 2,
      food: 2,
      greenery: 4,
      arts: 2,
      gathering: 3,
      smallShops: 3,
    },
    priorities: ["greenery", "gathering", "energy"],
  },
  port: {
    ratings: {
      energy: 1,
      food: 2,
      greenery: 2,
      arts: 3,
      gathering: 3,
      smallShops: 2,
    },
    priorities: ["energy", "arts", "gathering"],
  },
};

const initialRatings: Record<DimensionId, number> = Object.fromEntries(
  VIBE_DIMENSIONS.map(({ key }) => [key, 2]),
) as Record<DimensionId, number>;

export type QuestionnaireAnswers = {
  place: string;
  memory: string;
  preference?: Record<DimensionId, number>;
  weights?: Partial<Record<DimensionId, number>>;
};

export default function Questionnaire({
  onSubmit,
  examples = [],
  busy = false,
  serverError = null,
  seedPhrase = "",
}: {
  onSubmit: (answers: QuestionnaireAnswers) => void;
  examples?: Bootstrap["examples"];
  busy?: boolean;
  serverError?: string | null;
  seedPhrase?: string;
}) {
  const [place, setPlace] = useState(seedPhrase);
  const [memory, setMemory] = useState(seedPhrase);
  const [ratings, setRatings] = useState(initialRatings);
  const [priorities, setPriorities] = useState(["", "", ""]);
  const [error, setError] = useState("");

  function submit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();

    if (priorities.some((value) => !value)) {
      setError("Choose your three most important qualities.");
      return;
    }

    if (new Set(priorities).size !== 3) {
      setError("Choose three different qualities.");
      return;
    }

    setError("");

    onSubmit({
      place: place.trim(),
      memory: memory.trim(),
      preference: ratings,
      weights: {
        [priorities[0]!]: PRIORITY_WEIGHTS[0],
        [priorities[1]!]: PRIORITY_WEIGHTS[1],
        [priorities[2]!]: PRIORITY_WEIGHTS[2],
      },
    });
  }

  return (
    <form className="stack" onSubmit={submit} aria-labelledby="story-form-title">
      <h3 id="story-form-title">Fine-tune with six qualities</h3>
      <p className="muted">
        Optional. These sliders only rank Jackson Heights, Red Hook, and Inwood.
        They stay off the main “place you miss” path.
      </p>

      <label htmlFor="place" className="prompt-label">
        City or neighborhood (optional)
      </label>
      <input
        id="place"
        type="text"
        value={place}
        disabled={busy}
        onChange={(event) => setPlace(event.target.value)}
        placeholder="A neighborhood you keep comparing New York to"
      />

      <label htmlFor="memory" className="prompt-label">
        What does it feel like to you? (optional)
      </label>
      <textarea
        id="memory"
        className="memory"
        value={memory}
        disabled={busy}
        onChange={(event) => setMemory(event.target.value)}
        placeholder="I remember lively evenings and small places to eat..."
        rows={3}
      />

      {examples.length > 0 && (
        <fieldset className="examples">
          <legend>Try an example</legend>
          <div className="chips">
            {examples.map((ex) => (
              <button
                key={ex.id}
                type="button"
                className="chip"
                disabled={busy}
                onClick={() => {
                  setMemory(ex.text);
                  const preset = EXAMPLE_PRESETS[ex.id];
                  if (preset) {
                    setRatings(preset.ratings);
                    setPriorities([...preset.priorities]);
                  }
                }}
              >
                {ex.label}
              </button>
            ))}
          </div>
        </fieldset>
      )}

      <h3>What is that place like?</h3>
      <p className="muted">
        Rate each quality from 0 to 4. Neighborhood scores on the same scale are
        editorial, not official NYC data.
      </p>

      {VIBE_DIMENSIONS.map(({ key, label, low, high }) => (
        <div key={key} className="range-field">
          <label htmlFor={key}>
            <strong>
              {label}: {ratings[key]}
            </strong>
          </label>
          <input
            id={key}
            type="range"
            min={0}
            max={4}
            step={1}
            value={ratings[key]}
            disabled={busy}
            onChange={(event) =>
              setRatings({
                ...ratings,
                [key]: Number(event.target.value),
              })
            }
          />
          <div className="range-ends">
            <span>{low}</span>
            <span>{high}</span>
          </div>
        </div>
      ))}

      <h3>Which three qualities matter most?</h3>

      {PRIORITY_LABELS.map((label, index) => (
        <div key={label} className="priority-field">
          <label className="prompt-label" htmlFor={`priority-${index}`}>
            {label}
          </label>
          <select
            id={`priority-${index}`}
            value={priorities[index]}
            disabled={busy}
            onChange={(event) => {
              const next = [...priorities];
              next[index] = event.target.value;
              setPriorities(next);
            }}
            required
          >
            <option value="">Choose a quality</option>
            {VIBE_DIMENSIONS.map(({ key, label: optionLabel }) => (
              <option key={key} value={key}>
                {optionLabel}
              </option>
            ))}
          </select>
        </div>
      ))}

      {(error || serverError) && (
        <p className="error" role="alert">
          {error || serverError}
        </p>
      )}

      <button type="submit" className="primary" disabled={busy}>
        {busy ? "Matching…" : "Match with these ratings"}
      </button>
    </form>
  );
}
