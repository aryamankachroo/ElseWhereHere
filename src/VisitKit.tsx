import { useMemo, useState } from "react";
import type { DimensionId, VisitGuide, VisitStop } from "./types";

const VISIT_KEY = "elsewhere-here:saved-visit";

function mapsUrl(lat: number, lon: number, title: string) {
  const q = encodeURIComponent(`${title} @${lat},${lon}`);
  return `https://www.openstreetmap.org/?mlat=${lat}&mlon=${lon}#map=17/${lat}/${lon}&q=${q}`;
}

function directionsUrl(lat: number, lon: number) {
  return `https://www.google.com/maps/dir/?api=1&destination=${lat},${lon}`;
}

export function orderStopsForPriorities(
  stops: VisitStop[],
  weights: Partial<Record<DimensionId, number>>,
): VisitStop[] {
  const arrival = stops.filter((s) => s.isArrival);
  const rest = stops.filter((s) => !s.isArrival);
  const score = (stop: VisitStop) =>
    stop.emphasizes.reduce((sum, dim) => sum + (weights[dim] ?? 0), 0);
  return [...arrival, ...[...rest].sort((a, b) => score(b) - score(a))];
}

function visitAsText(
  name: string,
  borough: string,
  guide: VisitGuide,
  stops: VisitStop[],
): string {
  const lines = [
    `${name}, ${borough} — visit (${guide.duration})`,
    "",
    `How to get there: ${guide.arrive.summary}`,
    `Station: ${guide.arrive.station}`,
    `About ${guide.arrive.fromMidtownMinutes} minutes from Midtown, if trains and buses cooperate.`,
    `Best time: ${guide.bestTime}`,
    "",
    "Walk:",
    ...stops.map(
      (s, i) =>
        `${i + 1}. ${s.title} (~${s.minutes} min)\n   ${s.do}\n   Look for: ${s.lookFor}`,
    ),
    "",
    "Ground rules:",
    ...guide.groundRules.map((r) => `- ${r}`),
    "",
    `Skip this visit if: ${guide.skipIf}`,
  ];
  return lines.join("\n");
}

export default function VisitKit({
  name,
  borough,
  guide,
  weights,
}: {
  name: string;
  borough: string;
  guide: VisitGuide;
  weights?: Partial<Record<DimensionId, number>>;
}) {
  const stops = useMemo(
    () => orderStopsForPriorities(guide.stops, weights ?? {}),
    [guide.stops, weights],
  );
  const totalWalk = stops.reduce((sum, s) => sum + s.minutes, 0);
  const [copied, setCopied] = useState(false);
  const [saved, setSaved] = useState(() => {
    try {
      return localStorage.getItem(VISIT_KEY)?.includes(name) ?? false;
    } catch {
      return false;
    }
  });

  async function copyPlan() {
    const text = visitAsText(name, borough, guide, stops);
    try {
      await navigator.clipboard.writeText(text);
      setCopied(true);
    } catch {
      setCopied(false);
    }
  }

  function savePlan() {
    const text = visitAsText(name, borough, guide, stops);
    localStorage.setItem(
      VISIT_KEY,
      JSON.stringify({
        name,
        borough,
        text,
        savedAt: new Date().toISOString(),
      }),
    );
    setSaved(true);
  }

  return (
    <section className="visit-kit" aria-labelledby="visit-title">
      <p className="kicker">Your visit · {borough}</p>
      <h2 id="visit-title">A half-day you can actually do</h2>
      <p className="worth">{guide.worthTheTrip}</p>

      <dl className="visit-facts">
        <div>
          <dt>Time on the ground</dt>
          <dd>
            {guide.duration} ({totalWalk} minutes of walking, not including
            transit)
          </dd>
        </div>
        <div>
          <dt>When to go</dt>
          <dd>{guide.bestTime}</dd>
        </div>
        <div>
          <dt>From Midtown</dt>
          <dd>About {guide.arrive.fromMidtownMinutes} minutes if connections work</dd>
        </div>
      </dl>

      <div className="arrive-card">
        <h3>How to get there</h3>
        <p>
          <strong>{guide.arrive.station}</strong>
        </p>
        <p>{guide.arrive.summary}</p>
        <p className="muted">{guide.arrive.caution}</p>
        <a
          className="ghost"
          href={directionsUrl(stops[0]?.lat ?? 0, stops[0]?.lon ?? 0)}
          target="_blank"
          rel="noreferrer"
        >
          Directions to the first stop
        </a>
      </div>

      <p className="skip">
        <strong>Skip this if:</strong> {guide.skipIf}
      </p>

      <h3>Walk in this order</h3>
      <p className="muted">
        Stops after you arrive are ordered by what you said matters most. Times
        are walking-and-looking estimates, not timed tickets.
      </p>
      <ol className="visit-stops">
        {stops.map((stop, index) => (
          <li key={stop.id}>
            <div className="stop-head">
              <span className="stop-num">{index + 1}</span>
              <div>
                <strong>{stop.title}</strong>
                <span className="muted"> ~{stop.minutes} min</span>
              </div>
            </div>
            <p>{stop.do}</p>
            <p className="look">
              <strong>Look for:</strong> {stop.lookFor}
            </p>
            <div className="actions">
              <a
                className="ghost"
                href={mapsUrl(stop.lat, stop.lon, stop.title)}
                target="_blank"
                rel="noreferrer"
              >
                Map
              </a>
              <a
                className="ghost"
                href={directionsUrl(stop.lat, stop.lon)}
                target="_blank"
                rel="noreferrer"
              >
                Walk here
              </a>
            </div>
          </li>
        ))}
      </ol>

      <h3>So you do not embarrass yourself—or bother residents</h3>
      <ul className="ground-rules">
        {guide.groundRules.map((rule) => (
          <li key={rule}>{rule}</li>
        ))}
      </ul>

      <div className="actions">
        <button type="button" className="primary" onClick={savePlan}>
          {saved ? "Saved on this phone" : "Save this visit on this device"}
        </button>
        <button type="button" className="ghost" onClick={() => void copyPlan()}>
          {copied ? "Copied" : "Copy the walk"}
        </button>
      </div>
    </section>
  );
}
