"""Elsewhere Here API. Match uses the same score as the frontend ranker."""

from fastapi import FastAPI, HTTPException
from fastapi.middleware.cors import CORSMiddleware
from pydantic import BaseModel

from backend.scoring import explain_score, load_places, rank_places

app = FastAPI(title="Elsewhere Here")
app.add_middleware(
    CORSMiddleware,
    allow_origins=["http://127.0.0.1:5173", "http://localhost:5173"],
    allow_methods=["*"],
    allow_headers=["*"],
)


class Preference(BaseModel):
    tag: str
    target: float
    importance: int


class MatchBody(BaseModel):
    preferences: list[Preference]
    droppedTags: list[str] = []
    text: str = ""
    lat: float
    lng: float


class InterpretBody(BaseModel):
    text: str


def illustration_for(place: dict) -> str:
    tags = place.get("tags", [])
    if "food" in tags:
        return "street"
    if "culture" in tags or "history" in tags:
        return "gallery"
    return "garden"


def profile_from_place(place: dict) -> dict:
    return {
        "id": place["id"],
        "name": place["name"],
        "neighborhood": place.get("neighborhood", "New York"),
        "borough": place.get("borough", "New York"),
        "coordinates": {"lat": place["lat"], "lng": place["lng"]},
        "illustration": illustration_for(place),
        "imageAttribution": "Map location for this prototype. Not a reviewed photograph.",
        "description": place.get("blurb", ""),
        "differenceNote": place.get("blurb", ""),
        "entryNodeId": f"{place['id']}-intro",
        "storyNodes": [
            {
                "id": f"{place['id']}-intro",
                "kind": "intro",
                "text": place.get("blurb", ""),
                "location": {
                    "coordinates": {"lat": place["lat"], "lng": place["lng"]},
                    "label": place["name"],
                    "verified": True,
                },
                "citationIds": [],
            }
        ],
        "citations": [],
        "contentVersion": "score-v1",
        "isSample": True,
        "suggestedQuestions": [],
    }


@app.get("/api/v1/places")
def list_places():
    return [
        {
            "id": place["id"],
            "name": place["name"],
            "neighborhood": place.get("neighborhood"),
            "borough": place.get("borough"),
            "illustration": illustration_for(place),
            "imageAttribution": "Map location for this prototype. Not a reviewed photograph.",
            "isSample": True,
        }
        for place in load_places()
    ]


@app.get("/api/v1/places/{place_id}")
def get_place(place_id: str):
    place = next((row for row in load_places() if row["id"] == place_id), None)
    if place is None:
        raise HTTPException(status_code=404, detail=f'No place found for id "{place_id}".')
    return profile_from_place(place)


@app.post("/api/v1/match")
def match(body: MatchBody):
    if not body.preferences:
        raise HTTPException(status_code=400, detail="At least one confirmed quality is required.")
    ranked = rank_places(
        {"lat": body.lat, "lng": body.lng},
        body.text,
        preferences=[pref.model_dump() for pref in body.preferences],
        dropped_tags=body.droppedTags,
    )
    if not ranked:
        raise HTTPException(
            status_code=404,
            detail="Nothing free in the current list is within a 15-minute walk of you.",
        )
    winner = ranked[0]
    score = winner["score"]
    suggestions = [
        {
            "placeId": row["place"]["id"],
            "name": row["place"]["name"],
            "neighborhood": row["place"].get("neighborhood"),
            "borough": row["place"].get("borough"),
            "score": row["score"],
            "note": explain_score(row["user"], row["place"]),
        }
        for row in ranked
    ]
    return {
        "placeId": winner["place"]["id"],
        "reasons": [suggestions[0]["note"], f"Similarity score {score} out of 100."],
        "limitations": (
            "Distance, cost, and localness all counted. A miss on a requested quality lowers the score and still leaves the place on the list."
            if score >= 70
            else "This is the closest place within a 15-minute walk. The request did not line up fully, so the score stays partial."
        ),
        "matchLabel": "strong connection" if score >= 70 else "partial connection",
        "alternatives": [row["placeId"] for row in suggestions[1:]],
        "suggestions": suggestions,
        "citations": [],
    }


@app.post("/api/v1/interpret")
def interpret(body: InterpretBody):
    text = body.text.strip().lower()
    rules = [
        ("calm", ["quiet", "calm", "peaceful", "still", "tranquil"]),
        ("greenery", ["garden", "green", "plant", "park", "tree", "nature"]),
        ("reading", ["read", "book", "browse", "library"]),
        ("linger", ["linger", "no rush", "in a hurry", "slow pace", "unhurried"]),
        ("lively", ["lively", "busy", "bustling", "buzzing", "vibrant", "street"]),
        ("small-food-shops", ["food shop", "food shops", "little food", "small food", "snack", "market", "deli", "bakery"]),
        ("evening-activity", ["evening", "night", "after dark", "dusk"]),
        ("art", ["art", "mural", "gallery", "paint", "sculpture"]),
        ("independent-shops", ["independent shop", "indie shop", "small shop", "boutique", "shops", "corner store"]),
        ("waterfront", ["water", "river", "waterfront", "harbor", "pier", "sea", "canal"]),
    ]
    tags = [tag for tag, words in rules if any(word in text for word in words)]
    if not tags:
        return {
            "preferences": [],
            "needsClarification": True,
            "clarificationQuestion": "What do you love about it?",
            "mode": "live",
        }
    return {
        "preferences": [
            {"tag": tag, "target": 0.8, "importance": 2 if index < 2 else 1} for index, tag in enumerate(tags)
        ],
        "needsClarification": False,
        "mode": "live",
    }


@app.post("/api/v1/ask")
def ask():
    return {
        "status": "insufficient-evidence",
        "claims": [],
        "citationIds": [],
        "message": "This prototype does not answer questions from outside sources yet.",
    }
