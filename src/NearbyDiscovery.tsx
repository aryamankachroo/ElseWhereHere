import { useEffect, useState } from "react";
import { requestDiscover } from "./api";
import type { DiscoverPlace } from "./types";

const QUEENS_DEMO = { lat: 40.746509, lon: -73.842321 };

type NearbyDiscoveryProps = {
  neighborhood?: string;
  borough?: string;
  neighborhoodLat?: number;
  neighborhoodLon?: number;
  heading?: string;
  sectionId?: string;
};

function observationFor(place: DiscoverPlace): string {
  if (place.inscription) return "Look for the inscription. What does it tell you?";
  if (place.material) {
    return `Look closely: where can you see the ${place.material.toLowerCase()}?`;
  }
  return "What detail would you have walked past?";
}

export default function NearbyDiscovery({
  neighborhood,
  borough,
  neighborhoodLat,
  neighborhoodLon,
  heading = "A documented thing to look at nearby",
  sectionId,
}: NearbyDiscoveryProps) {
  const [places, setPlaces] = useState<DiscoverPlace[]>([]);
  const [index, setIndex] = useState(0);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState("");
  const [disclaimer, setDisclaimer] = useState("");

  useEffect(() => {
    return () => {
      if ("speechSynthesis" in window) window.speechSynthesis.cancel();
    };
  }, []);

  useEffect(() => {
    if (
      neighborhoodLat == null ||
      neighborhoodLon == null ||
      !Number.isFinite(neighborhoodLat) ||
      !Number.isFinite(neighborhoodLon)
    ) {
      return;
    }
    void load(neighborhoodLat, neighborhoodLon, borough);
    // Load once for this match so the visitor is not staring at empty buttons.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [neighborhoodLat, neighborhoodLon, borough]);

  async function load(lat: number, lon: number, boroughFilter?: string) {
    setBusy(true);
    setError("");

    try {
      const data = await requestDiscover(lat, lon, boroughFilter);
      setPlaces(data.places);
      setDisclaimer(data.disclaimer);
      setIndex(0);
    } catch (err) {
      setPlaces([]);
      setDisclaimer("");
      setError(err instanceof Error ? err.message : "Could not load places.");
    } finally {
      setBusy(false);
    }
  }

  function useMyLocation() {
    if (!navigator.geolocation) {
      setError("Location is unavailable in this browser.");
      return;
    }

    setBusy(true);
    setError("");
    navigator.geolocation.getCurrentPosition(
      ({ coords }) => {
        void load(coords.latitude, coords.longitude);
      },
      () => {
        setBusy(false);
        setError("Location was unavailable. Try the demo location.");
      },
      { timeout: 10000 },
    );
  }

  const place = places[index];
  const observation = place ? observationFor(place) : "";
  const description = place
    ? `${place.title} is a ${place.kind.toLowerCase()} at ${place.location}. ${observation}`
    : "";

  function play() {
    if (!("speechSynthesis" in window)) {
      setError("Audio playback is unavailable in this browser.");
      return;
    }

    window.speechSynthesis.cancel();
    window.speechSynthesis.speak(new SpeechSynthesisUtterance(description));
  }

  const titleId = sectionId ? `${sectionId}-title` : "discover-title";
  const hasNeighborhoodPoint =
    neighborhoodLat != null &&
    neighborhoodLon != null &&
    Number.isFinite(neighborhoodLat) &&
    Number.isFinite(neighborhoodLon);

  return (
    <section
      className="nearby-discovery city-records"
      id={sectionId}
      aria-labelledby={titleId}
    >
      <p className="kicker">NYC Open Data · public-art inventory</p>
      <h2 id={titleId}>{heading}</h2>
      <p className="muted">
        These are Public Design Commission outdoor-art rows (dataset 2pg3-gcaa),
        not a neighborhood recommendation. Jackson Heights, Red Hook, and Inwood
        are the only curated matches in this app. This list is extra documented
        objects near{" "}
        {neighborhood ?? "this location"}
        {borough ? `, ${borough}` : ""}.
      </p>

      <div className="actions">
        <button type="button" className="primary" onClick={useMyLocation} disabled={busy}>
        {busy ? "Finding a place…" : "Use my location instead"}
        </button>
        <button
          type="button"
          className="ghost"
          onClick={() => void load(QUEENS_DEMO.lat, QUEENS_DEMO.lon, "Queens")}
          disabled={busy}
        >
          Try a Queens demo
        </button>
        {hasNeighborhoodPoint && (
          <button
            type="button"
            className="ghost"
            onClick={() => void load(neighborhoodLat, neighborhoodLon, borough)}
            disabled={busy}
          >
            Near {neighborhood ?? "this match"} (inventory, not a match)
          </button>
        )}
      </div>

      {error && (
        <p className="error" role="alert">
          {error}
        </p>
      )}

      {!busy && places.length === 0 && !error && (
        <p>Choose a location if the neighborhood load did not return a record.</p>
      )}

      {place && (
        <article className="nearby-place">
          {disclaimer && <p className="muted">{disclaimer}</p>}
          <p>{place.distanceKm.toFixed(1)} km away</p>
          <h3>{place.title}</h3>
          <p>{place.location}</p>
          <p>
            <strong>Notice:</strong> {observation}
          </p>

          <div className="actions">
            <button type="button" className="primary" onClick={play}>
              ▶ Play short description
            </button>
            <a
              className="ghost"
              href={`https://www.openstreetmap.org/?mlat=${place.lat}&mlon=${place.lon}#map=18/${place.lat}/${place.lon}`}
              target="_blank"
              rel="noreferrer"
            >
              See location
            </a>
            <a className="ghost" href={place.source} target="_blank" rel="noreferrer">
              City data source
            </a>
            <button
              type="button"
              className="ghost"
              onClick={() => setIndex((current) => (current + 1) % places.length)}
              disabled={places.length < 2}
            >
              Another nearby place
            </button>
          </div>
        </article>
      )}
    </section>
  );
}
