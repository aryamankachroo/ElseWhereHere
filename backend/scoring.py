"""Same ranking as src/lib/rankPlaces.ts. Distance, cost, and localness always count."""

from __future__ import annotations

import json
import math
import re
from datetime import datetime, timedelta
from pathlib import Path

PLACES_PATH = Path(__file__).resolve().parents[1] / "src" / "data" / "places.json"
TAG_WORDS = {
    "outdoors": ["outdoor", "park", "garden", "outside", "walk"],
    "food": ["food", "market", "eat", "lunch", "farmers"],
    "culture": ["music", "event", "show", "culture", "concert"],
    "history": ["history", "historic", "old"],
    "quiet": ["quiet", "calm", "sit", "peaceful"],
    "family": ["kid", "kids", "family", "children", "playground"],
}


def load_places() -> list[dict]:
    return json.loads(PLACES_PATH.read_text())


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
    distance_score = 1 - min(walk / user["maxMinutes"], 1)
    if distance_score == 0:
        return None
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
