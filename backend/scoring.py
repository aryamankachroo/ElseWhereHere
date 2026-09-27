"""Same ranking as src/lib/rankPlaces.ts. Distance, cost, and localness always count."""

from __future__ import annotations

import csv
import math
import os
import re
from datetime import datetime, timedelta
from pathlib import Path

from dotenv import load_dotenv

PLACES_PATH = Path(__file__).resolve().parents[1] / "data" / "places.csv"
# clean and shade are unknown in this file. 0.5 keeps them neutral when the sentence asks.
TYPE_RULES = {
    "garden": {"tags": ["outdoors", "quiet"], "local": 0.9, "free": True, "allDay": True},
    "farmers_market": {"tags": ["food"], "local": 0.75, "free": True, "allDay": True},
    "pops": {"tags": ["outdoors"], "local": 0.85, "free": True, "allDay": True},
    "public_art": {"tags": ["culture"], "local": 0.7, "free": True, "allDay": True},
    "restaurant": {"tags": ["food"], "local": 0.6, "free": False, "allDay": False},
}
TAG_WORDS = {
    "outdoors": ["outdoor", "park", "garden", "outside", "walk"],
    "food": ["food", "market", "eat", "lunch", "farmers"],
    "culture": ["music", "event", "show", "culture", "concert"],
    "history": ["history", "historic", "old"],
    "quiet": ["quiet", "calm", "sit", "peaceful"],
    "family": ["kid", "kids", "family", "children", "playground"],
}


def _slug(value: str) -> str:
    slug = re.sub(r"[^a-z0-9]+", "-", (value or "").lower()).strip("-")
    return slug or "place"


def _blurb(kind: str, detail: str, neighborhood: str) -> str:
    where = f" in {neighborhood}" if neighborhood else ""
    if kind == "garden":
        return f"A community garden{where}."
    if kind == "farmers_market":
        text = f"A farmers market{where}."
        if detail:
            text += f" Open {detail}."
        return text
    if kind == "pops":
        text = f"A public open space{where}."
        if detail:
            text += f" {detail}."
        return text
    if kind == "public_art":
        text = f"Public art{where}."
        if detail:
            text += f" {detail}."
        return text
    if kind == "restaurant":
        label = f"{detail} restaurant" if detail else "A restaurant"
        return f"{label}{where}."
    return ""


def _read_places() -> list[dict]:
    places = []
    with PLACES_PATH.open(newline="") as handle:
        for row in csv.DictReader(handle):
            rule = TYPE_RULES.get(row.get("type", ""))
            if rule is None:
                continue
            try:
                lat = float(row["latitude"])
                lng = float(row["longitude"])
            except (TypeError, ValueError):
                continue
            name = (row.get("name") or "").strip()
            if not name:
                continue
            detail = (row.get("detail") or "").strip()
            neighborhood = (row.get("neighborhood") or "").strip()
            places.append(
                {
                    "id": f"{row['type']}-{_slug(name)}-{lat:.5f}-{lng:.5f}",
                    "name": name,
                    "neighborhood": neighborhood,
                    "borough": (row.get("borough") or "").strip(),
                    "lat": lat,
                    "lng": lng,
                    "tags": list(rule["tags"]),
                    "free": rule["free"],
                    "allDay": rule["allDay"],
                    "clean": 0.5,
                    "shade": 0.5,
                    "local": rule["local"],
                    "blurb": _blurb(row["type"], detail, neighborhood),
                }
            )
    return places


_PLACES: list[dict] | None = None


def _service_url() -> str | None:
    load_dotenv(Path(__file__).resolve().parent / ".env")
    return os.environ.get("TIMESCALE_SERVICE_URL") or None


def _read_database(url: str) -> list[dict]:
    import psycopg

    places = []
    with psycopg.connect(url) as conn:
        rows = conn.execute(
            """
            SELECT id, name, neighborhood, borough, lat, lng, tags, free, all_day, clean, shade, localness, blurb
            FROM places
            """
        ).fetchall()
    for row in rows:
        places.append(
            {
                "id": row[0],
                "name": row[1],
                "neighborhood": row[2] or "",
                "borough": row[3] or "",
                "lat": row[4],
                "lng": row[5],
                "tags": list(row[6] or []),
                "free": row[7],
                "allDay": row[8],
                "clean": row[9],
                "shade": row[10],
                "local": row[11],
                "blurb": row[12],
            }
        )
    return places


def record_match(place_id: str, place_name: str, score: int, lat: float, lng: float) -> None:
    url = _service_url()
    if not url:
        return
    import psycopg

    with psycopg.connect(url) as conn:
        conn.execute(
            """
            INSERT INTO matches (time, place_id, place_name, score, lat, lng)
            VALUES (NOW(), %s, %s, %s, %s, %s)
            """,
            (place_id, place_name, score, lat, lng),
        )


def load_places() -> list[dict]:
    global _PLACES
    if _PLACES is None:
        url = _service_url()
        _PLACES = _read_database(url) if url else _read_places()
    return _PLACES


def parse_prompt(text: str) -> dict:
    q = (text or "").lower()
    tags = [tag for tag, words in TAG_WORDS.items() if any(word in q for word in words)]
    cost = "free"
    if "cheap" in q:
        cost = "cheap"
    if re.search(r"\b(paid|ticket|either)\b", q):
        cost = "either"
    local = 0 if re.search(r"\b(famous|tourist|landmark)\b", q) else 1
    care = 1 if re.search(r"\b(shade|shady|air|hot)\b", q) else None
    return {
        "tags": tags,
        "cost": cost,
        "local": local,
        "care": care,
        "window": parse_window(q),
        "maxMinutes": 15,
    }


def parse_window(q: str):
    now = datetime.now()
    if "now" in q:
        return (now, now + timedelta(hours=3))
    if "tonight" in q:
        start = now.replace(hour=17, minute=0, second=0, microsecond=0)
        end = now.replace(hour=22, minute=0, second=0, microsecond=0)
        return (start, end)
    if re.search(r"\b(weekend|saturday|sunday)\b", q):
        days_until_sat = (5 - now.weekday()) % 7
        start = (now + timedelta(days=days_until_sat)).replace(hour=10, minute=0, second=0, microsecond=0)
        end = (start + timedelta(days=1)).replace(hour=18, minute=0, second=0, microsecond=0)
        return (start, end)
    return None


def distance_meters(a: dict, b: dict) -> float:
    radius = 6371000
    d_lat = math.radians(b["lat"] - a["lat"])
    d_lng = math.radians(b["lng"] - a["lng"])
    lat1 = math.radians(a["lat"])
    lat2 = math.radians(b["lat"])
    h = math.sin(d_lat / 2) ** 2 + math.cos(lat1) * math.cos(lat2) * math.sin(d_lng / 2) ** 2
    return 2 * radius * math.asin(min(1, math.sqrt(h)))


def time_fit(window, place: dict):
    if not window:
        return None
    if place.get("allDay"):
        return 1
    if not place.get("start") or not place.get("end"):
        return 0
    ws, we = window
    ps = datetime.fromisoformat(place["start"])
    pe = datetime.fromisoformat(place["end"])
    if ps < we and pe > ws:
        return 1
    return 0.5 if ws.date() == ps.date() else 0


def score_place(user: dict, place: dict):
    terms = []
    walk = distance_meters(user, place) / 80
    # Closer places score higher. Distance never removes a place from the list.
    distance_score = 1 / (1 + walk / user["maxMinutes"])
    terms.append((distance_score, 3))

    if user["cost"] == "free" and not place.get("free"):
        return None
    cost_score = 1 if place.get("free") or user["cost"] == "either" else 0.6
    terms.append((cost_score, 2))

    local_score = 1 - abs(user["local"] - place.get("local", 0))
    terms.append((local_score, 2))

    if user["tags"]:
        hit = sum(1 for tag in user["tags"] if tag in place.get("tags", []))
        terms.append((hit / len(user["tags"]), 3))

    fitted = time_fit(user["window"], place)
    if fitted is not None:
        terms.append((fitted, 2))

    if user["care"] is not None:
        terms.append((1 - user["care"] * (1 - place.get("clean", 0)), 1.5))
        terms.append((1 - user["care"] * (1 - place.get("shade", 0)), 1))

    weight_sum = sum(weight for _, weight in terms)
    raw = sum(value * weight for value, weight in terms)
    return int(raw / weight_sum * 100 + 0.5)


QUALITY_TO_TAGS = {
    "calm": ["quiet"],
    "linger": ["quiet"],
    "reading": ["quiet"],
    "greenery": ["outdoors"],
    "waterfront": ["outdoors"],
    "small-food-shops": ["food"],
    "art": ["culture"],
    "evening-activity": [],
}


def apply_qualities(parsed: dict, preferences: list[dict], dropped_tags: list[str]) -> dict:
    tags = set(parsed["tags"])
    for tag in dropped_tags:
        for score_tag in QUALITY_TO_TAGS.get(tag, []):
            tags.discard(score_tag)
    for pref in preferences:
        for score_tag in QUALITY_TO_TAGS.get(pref.get("tag", ""), []):
            tags.add(score_tag)
    window = parsed["window"]
    if window is None and any(pref.get("tag") == "evening-activity" for pref in preferences):
        now = datetime.now()
        start = now.replace(hour=17, minute=0, second=0, microsecond=0)
        end = now.replace(hour=22, minute=0, second=0, microsecond=0)
        window = (start, end)
    return {**parsed, "tags": list(tags), "window": window}


def explain_score(user: dict, place: dict) -> str:
    minutes = max(1, int(distance_meters(user, place) / 80 + 0.5))
    parts = [f"About a {minutes}-minute walk."]
    if place.get("free"):
        parts.append("Free to enter.")
    else:
        parts.append("Not free, so it only stays in the list when cost is flexible.")
    if place.get("local", 0) >= 0.75:
        parts.append("Neighbors use it more than visitors do.")
    if user["tags"]:
        hit = [tag for tag in user["tags"] if tag in place.get("tags", [])]
        if not hit:
            asked = " and ".join(user["tags"])
            parts.append(f"Asked for {asked}, and this place misses that, so the score drops.")
        else:
            parts.append(f"Matches {' and '.join(hit)}.")
    return " ".join(parts)


def rank_places(
    pin: dict,
    prompt: str,
    places: list[dict] | None = None,
    preferences: list[dict] | None = None,
    dropped_tags: list[str] | None = None,
):
    parsed = apply_qualities(parse_prompt(prompt), preferences or [], dropped_tags or [])
    user = {"lat": pin["lat"], "lng": pin["lng"], **parsed}
    rows = []
    for place in places if places is not None else load_places():
        score = score_place(user, place)
        if score is not None:
            rows.append({"place": place, "score": score, "user": user})
    rows.sort(key=lambda row: row["score"], reverse=True)
    return rows[:8]
