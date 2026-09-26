import { useId, useState } from "react";
import { requestPlaces } from "./api";
import {
  BOROUGH_POINT,
  CATEGORY_LABEL,
  NYC_BOROUGHS,
  type NycBoroughName,
} from "./placeOptions";
import type { PlaceRecommendation, PlacesResult } from "./types";

export default function PlaceDiscovery({
  headline = "Drop a pin and write one sentence.",
  intro,
}: {
  headline?: string;
  intro?: string;
}) {
  const sentenceId = useId();
  const walkId = useId();
  const resultId = useId();
  const [pin, setPin] = useState<{
    lat: number;
    lon: number;
    label: string;
    borough?: NycBoroughName;
  } | null>(null);
  const [sentence, setSentence] = useState("");
  const [maxWalkMinutes, setMaxWalkMinutes] = useState(20);
  const [cost, setCost] = useState<"any" | "free">("any");
  const [costTouched, setCostTouched] = useState(false);
  const [results, setResults] = useState<PlaceRecommendation[]>([]);
  const [payload, setPayload] = useState<PlacesResult | null>(null);
  const [index, setIndex] = useState(0);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState("");
  const [notice, setNotice] = useState(
    "Defaults are visible: about 20 minutes (straight-line estimate) and any cost, including unknown. An empty sentence does not assume free or a 15-minute walk.",
  );

  function dropBoroughPin(name: NycBoroughName) {
    const point = BOROUGH_POINT[name];
    setPin({ lat: point.lat, lon: point.lon, label: `${name} center`, borough: name });
    setNotice(`Pin dropped on the ${name} borough center. You can still use your location.`);
  }

  function useMyLocation() {
    setError("");
    if (!navigator.geolocation) {
      setNotice("This browser cannot share location. Drop a pin on a borough instead.");
      return;
    }
    setBusy(true);
    setNotice("Asking for location…");
    navigator.geolocation.getCurrentPosition(
      ({ coords }) => {
        setPin({
          lat: coords.latitude,
          lon: coords.longitude,
          label: "your location",
        });
        setBusy(false);
        setNotice("Pin dropped on your location. City tables are not limited to one borough.");
      },
      (err) => {
        setBusy(false);
        if (err.code === err.PERMISSION_DENIED) {
          setNotice("Location access was denied. Drop a pin on a borough instead.");
          return;
        }
        setNotice("Location was unavailable. Drop a pin on a borough instead.");
      },
      { timeout: 10000, maximumAge: 60_000 },
    );
  }

  async function rankPlaces() {
    setError("");
    if (!pin) {
      setError("Drop a pin first — your location or a borough center.");
      return;
    }
    setBusy(true);
    try {
      const data = await requestPlaces({
        lat: pin.lat,
        lon: pin.lon,
        borough: pin.borough,
        sentence,
        maxWalkMinutes,
        cost: costTouched ? cost : undefined,
      });
      const list = data.recommendations;
      setPayload(data);
      if (list.length === 0) {
        setResults([]);
        setError("No matching city records came back. Try another sentence or pin.");
        return;
      }
      setResults(list);
      setIndex(0);
      setNotice("");
    } catch {
      setResults([]);
      setPayload(null);
      setError("City records are unavailable right now. Try again in a moment.");
    } finally {
      setBusy(false);
    }
  }

  const place = results[index];

  return (
    <section className="stack place-discovery">
      <h2>{headline}</h2>
      <p className="lede">
        {intro ??
          "This ranks documented NYC Open Data places near the pin. It is not the Jackson Heights / Red Hook / Inwood neighborhood story, and the number is a recommendation score — not safety, authenticity, or an official rating."}
      </p>

      <fieldset className="interest-fieldset">
        <legend>Drop a pin</legend>
        <div className="chips" role="group" aria-label="Pin">
          <button type="button" className="chip" disabled={busy} onClick={useMyLocation}>
            Use my location
          </button>
          {NYC_BOROUGHS.map((name) => (
            <button
              key={name}
              type="button"
              className={pin?.borough === name ? "chip picked" : "chip"}
              disabled={busy}
              onClick={() => dropBoroughPin(name)}
            >
              {name}
            </button>
          ))}
        </div>
      </fieldset>

      {pin && (
        <p className="muted" role="status">
          Pin: {pin.lat.toFixed(4)}, {pin.lon.toFixed(4)} ({pin.label})
        </p>
      )}

      <label htmlFor={sentenceId} className="prompt-label">
        One sentence
      </label>
      <input
        id={sentenceId}
        className="welcome-input"
        type="text"
        value={sentence}
        disabled={busy}
        autoComplete="off"
        placeholder="free garden nearby, market Sunday, or leave blank"
        onChange={(event) => setSentence(event.target.value)}
      />
      <p className="muted">
        Interest tags and a requested time are added only when the sentence names them. Whole
        words only — “art” will not match “part.”
      </p>

      <div className="defaults-row">
        <div className="range-field">
          <label className="prompt-label" htmlFor={walkId}>
            Estimated walk limit
          </label>
          <input
            id={walkId}
            type="number"
            min={5}
            max={90}
            step={5}
            value={maxWalkMinutes}
            disabled={busy}
            onChange={(event) => setMaxWalkMinutes(Number(event.target.value))}
          />
          <p className="muted">
            Default 20 minutes. This is a straight-line estimate, not a verified route or an
            actual 15-minute walk.
          </p>
        </div>
        <fieldset className="interest-fieldset">
          <legend>Cost default</legend>
          <div className="chips" role="radiogroup" aria-label="Cost">
            <button
              type="button"
              className={cost === "any" ? "chip picked" : "chip"}
              aria-pressed={cost === "any"}
              disabled={busy}
              onClick={() => {
                setCostTouched(true);
                setCost("any");
              }}
            >
              Any, including unknown
            </button>
            <button
              type="button"
              className={cost === "free" ? "chip picked" : "chip"}
              aria-pressed={cost === "free"}
              disabled={busy}
              onClick={() => {
                setCostTouched(true);
                setCost("free");
              }}
            >
              Free only
            </button>
          </div>
          <p className="muted">
            Default is any cost. Free only excludes restaurants and licensed shops verified as
            paid. Unknown cost is not treated as free and is not excluded.
          </p>
        </fieldset>
      </div>

      {notice && (
        <p className="note" role="status">
          {notice}
        </p>
      )}

      <div className="actions">
        <button type="button" className="primary" onClick={() => void rankPlaces()} disabled={busy}>
          {busy ? "Ranking places…" : "Rank places"}
        </button>
      </div>

      {error && (
        <p className="error" role="alert">
          {error}
        </p>
      )}

      {payload && (
        <p className="muted">
          {payload.disclaimer}
        </p>
      )}

      {place && (
        <article className="nearby-place" id={resultId} aria-live="polite">
          <p className="kicker">{CATEGORY_LABEL[place.category]}</p>
          <h3>{place.title}</h3>
          <p className="score-line">
            Recommendation score {place.recommendationScore}
          </p>
          <p>
            {place.borough} · {place.estimatedWalkMinutes} min estimated walk (
            {place.distanceKm.toFixed(2)} km straight-line)
          </p>
          <p>{place.whyItFits}</p>
          <ul className="score-factors">
            {place.factors.map((factor) => (
              <li key={factor.id}>
                <strong>{factor.label}</strong> {Math.round(factor.value * 100)} × {factor.weight}
                . {factor.evidence}
              </li>
            ))}
          </ul>
          {place.omittedFactors.length > 0 && (
            <details>
              <summary>Factors not used</summary>
              <ul className="score-factors">
                {place.omittedFactors.map((factor) => (
                  <li key={factor.id}>
                    <strong>{factor.id}</strong> — {factor.reason}
                  </li>
                ))}
              </ul>
            </details>
          )}
          <p className="muted">{place.walkLabel}</p>
          <div className="actions">
            <a className="ghost" href={place.sourceUrl} target="_blank" rel="noreferrer">
              Source
            </a>
            <a
              className="ghost"
              href={`https://www.openstreetmap.org/?mlat=${place.lat}&mlon=${place.lon}#map=16/${place.lat}/${place.lon}`}
              target="_blank"
              rel="noreferrer"
            >
              Map
            </a>
            <button
              type="button"
              className="primary"
              onClick={() => setIndex((current) => (current + 1) % results.length)}
              disabled={results.length < 2}
            >
              See more places
            </button>
          </div>
        </article>
      )}
    </section>
  );
}
