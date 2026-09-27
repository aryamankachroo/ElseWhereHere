"""Grok (xAI) client for place questions and source lookup, using live web search."""

from __future__ import annotations

import json
import os
import re
import urllib.error
import urllib.request
from pathlib import Path
from urllib.parse import urlparse

from dotenv import load_dotenv

XAI_URL = "https://api.x.ai/v1/responses"
DEFAULT_MODEL = "grok-4.7"
TIMEOUT_SECONDS = 120
MAX_SOURCES = 6


class GrokNotConfigured(Exception):
    pass


class GrokError(Exception):
    pass


def _settings() -> tuple[str, str]:
    load_dotenv(Path(__file__).resolve().parent / ".env", override=True)
    key = os.environ.get("XAI_API_KEY", "").strip()
    if not key:
        raise GrokNotConfigured("XAI_API_KEY is not set in backend/.env.")
    return key, os.environ.get("XAI_MODEL", "").strip() or DEFAULT_MODEL


def is_configured() -> bool:
    try:
        _settings()
    except GrokNotConfigured:
        return False
    return True


def _call(messages: list[dict]) -> dict:
    key, model = _settings()
    body = json.dumps({"model": model, "input": messages, "tools": [{"type": "web_search"}]}).encode()
    request = urllib.request.Request(
        XAI_URL,
        data=body,
        method="POST",
        headers={"Content-Type": "application/json", "Authorization": f"Bearer {key}"},
    )
    try:
        with urllib.request.urlopen(request, timeout=TIMEOUT_SECONDS) as response:
            return json.loads(response.read())
    except urllib.error.HTTPError as error:
        detail = error.read().decode(errors="replace")[:300]
        raise GrokError(f"xAI returned {error.code}: {detail}") from error
    except (urllib.error.URLError, TimeoutError) as error:
        raise GrokError(f"Could not reach xAI: {error}") from error


def _output_text_and_urls(response: dict) -> tuple[str, list[str]]:
    texts: list[str] = []
    urls: list[str] = []
    for item in response.get("output", []):
        if item.get("type") != "message":
            continue
        for part in item.get("content", []):
            if part.get("type") != "output_text":
                continue
            texts.append(part.get("text", ""))
            for note in part.get("annotations", []) or []:
                if note.get("type") == "url_citation" and note.get("url"):
                    urls.append(note["url"])
    for url in response.get("citations", []) or []:
        if isinstance(url, str):
            urls.append(url)
    return "\n".join(texts).strip(), list(dict.fromkeys(urls))


def _parse_json_block(text: str) -> dict | None:
    match = re.search(r"\{.*\}", text, re.DOTALL)
    if not match:
        return None
    try:
        data = json.loads(match.group(0))
    except json.JSONDecodeError:
        return None
    return data if isinstance(data, dict) else None


def _host(url: str) -> str:
    return urlparse(url).netloc.removeprefix("www.") or url


def _citations(sources: list, found_urls: list[str], id_prefix: str) -> list[dict]:
    """Keep model-described sources only when the URL came back from the search, so links are real.
    Bare search URLs fill in only when the model named none, since the search also visits unrelated pages."""
    found = set(found_urls)
    citations: list[dict] = []
    seen: set[str] = set()
    for source in sources if isinstance(sources, list) else []:
        if not isinstance(source, dict):
            continue
        url = str(source.get("url", "")).strip()
        if not url or url in seen or (found and url not in found):
            continue
        seen.add(url)
        citations.append(
            {
                "id": f"{id_prefix}-{len(citations) + 1}",
                "title": str(source.get("title") or _host(url)),
                "publisher": str(source.get("publisher") or _host(url)),
                "detail": str(source.get("detail") or "Found by Grok web search."),
                "url": url,
            }
        )
    for url in [] if citations else found_urls:
        if len(citations) >= MAX_SOURCES:
            break
        if url in seen:
            continue
        seen.add(url)
        citations.append(
            {
                "id": f"{id_prefix}-{len(citations) + 1}",
                "title": _host(url),
                "publisher": _host(url),
                "detail": "Found by Grok web search.",
                "url": url,
            }
        )
    return citations[:MAX_SOURCES]


def _describe(place: dict) -> str:
    where = ", ".join(part for part in [place.get("neighborhood"), place.get("borough"), "New York City"] if part)
    blurb = place.get("blurb") or ""
    return f"{place.get('name', 'this place')} ({where}). {blurb}".strip()


SOURCE_FORMAT = (
    'Each source is {"title": page title, "publisher": site or organization, '
    '"detail": one sentence on what it confirms, "url": exact URL you opened}.'
)


def ask(place: dict, question: str, history: list[dict]) -> dict:
    system = (
        "You are the guide inside Elsewhere Here, an app that helps newcomers find places in New York City. "
        f"The user is looking at: {_describe(place)} "
        "Answer questions about this place using web search. Prefer official, city, parks, and news sources. "
        "Keep answers to 2 to 4 short sentences in plain language. If sources disagree or you cannot confirm "
        "something, say so. Reply with JSON only: "
        '{"answer": string, "sources": [source, ...]}. ' + SOURCE_FORMAT
    )
    messages = [{"role": "system", "content": system}]
    for turn in history[-8:]:
        if turn.get("role") in ("user", "assistant") and turn.get("content"):
            messages.append({"role": turn["role"], "content": str(turn["content"])[:2000]})
    messages.append({"role": "user", "content": question})

    text, urls = _output_text_and_urls(_call(messages))
    data = _parse_json_block(text) or {}
    answer = str(data.get("answer") or text).strip()
    if not answer:
        raise GrokError("Grok returned an empty answer.")
    return {"answer": answer, "citations": _citations(data.get("sources", []), urls, "grok")}


def find_sources(place: dict) -> dict:
    system = (
        "You research places in New York City for Elsewhere Here. Use web search to find reliable sources "
        "about the place below: official park or venue pages, NYC Parks, city agencies, museums, and "
        "established news outlets. Skip listicles and reviews unless nothing else exists. "
        "Reply with JSON only: "
        '{"summary": 2 sentences on what the sources say, "sources": [source, ...]} with up to 5 sources. '
        + SOURCE_FORMAT
    )
    messages = [
        {"role": "system", "content": system},
        {"role": "user", "content": f"Find sources about {_describe(place)}"},
    ]
    text, urls = _output_text_and_urls(_call(messages))
    data = _parse_json_block(text) or {}
    return {
        "summary": str(data.get("summary") or "").strip(),
        "citations": _citations(data.get("sources", []), urls, f"src-{place.get('id', 'place')}"),
    }
