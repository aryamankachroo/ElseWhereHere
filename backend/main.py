"""Elsewhere Here API. Match uses the same score as the frontend ranker."""

from fastapi import FastAPI, HTTPException
from fastapi.middleware.cors import CORSMiddleware
from pydantic import BaseModel

try:
    from backend import grok
    from backend.scoring import explain_score, load_places, rank_places, record_match
except ImportError:
    import grok
    from scoring import explain_score, load_places, rank_places, record_match

app = FastAPI(title="Elsewhere Here")
app.add_middleware(
    CORSMiddleware,
    # elsewhere://localhost is the iOS app, which serves the bundled frontend from a custom scheme.
    allow_origins=["http://127.0.0.1:5173", "http://localhost:5173", "elsewhere://localhost"],
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


class ChatTurn(BaseModel):
    role: str
    content: str


class PlaceContext(BaseModel):
    name: str
    neighborhood: str | None = None
    borough: str | None = None


class AskBody(BaseModel):
    placeId: str
    storyNodeId: str = ""
    question: str
    previousQuestion: str | None = None
    history: list[ChatTurn] = []
    place: PlaceContext | None = None


class SourcesBody(BaseModel):
    placeId: str
    place: PlaceContext | None = None


def place_for(place_id: str, context: PlaceContext | None) -> dict:
    place = next((row for row in load_places() if row["id"] == place_id), None)
    if place is not None:
        return place
    if context is not None:
        return {"id": place_id, **context.model_dump()}
    raise HTTPException(status_code=404, detail=f'No place found for id "{place_id}".')


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
            detail="Nothing free is in the list. Mention cheap or paid if a ticket is fine.",
        )
    winner = ranked[0]
    score = winner["score"]
    record_match(winner["place"]["id"], winner["place"]["name"], score, body.lat, body.lng)
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
            else "This is the closest place. The request did not line up fully, so the score stays partial."
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


GROK_MISSING_MESSAGE = "Grok isn't set up yet. Add XAI_API_KEY to backend/.env and restart the API."

_SOURCES_CACHE: dict[str, dict] = {}


@app.post("/api/v1/ask")
def ask(body: AskBody):
    place = place_for(body.placeId, body.place)
    if not grok.is_configured():
        return {"status": "insufficient-evidence", "claims": [], "citationIds": [], "message": GROK_MISSING_MESSAGE}
    try:
        result = grok.ask(place, body.question, [turn.model_dump() for turn in body.history])
    except grok.GrokError as error:
        raise HTTPException(status_code=502, detail=str(error)) from error
    citation_ids = [citation["id"] for citation in result["citations"]]
    return {
        "status": "answered",
        "claims": [{"text": result["answer"], "citationIds": citation_ids}],
        "citationIds": citation_ids,
        "citations": result["citations"],
        "message": "Answered by Grok with live web search. Check the sources before relying on it.",
    }


@app.post("/api/v1/sources")
def sources(body: SourcesBody):
    place = place_for(body.placeId, body.place)
    if not grok.is_configured():
        return {"summary": "", "citations": [], "message": GROK_MISSING_MESSAGE}
    if body.placeId not in _SOURCES_CACHE:
        try:
            _SOURCES_CACHE[body.placeId] = grok.find_sources(place)
        except grok.GrokError as error:
            raise HTTPException(status_code=502, detail=str(error)) from error
    found = _SOURCES_CACHE[body.placeId]
    return {
        **found,
        "message": "Found by Grok with live web search. Not reviewed by the Elsewhere Here team."
        if found["citations"]
        else "Grok couldn't find reliable sources for this place.",
    }
